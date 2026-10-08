import logging
import os
import subprocess
import sys
import threading
from datetime import datetime
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask.json.provider import DefaultJSONProvider
from openpyxl import load_workbook

from finance import finance_bp, get_df, load_excel, _cache_lock, EXCEL_PATH, _read_excel_via_com
from performance import perf_bp
from kpi import kpi_bp, get_kpi_df, _real_code, KPI_EXCEL_PATH, load_kpi_excel, _kpi_cache_lock
from downloads import download_bp
from ai_insight import ai_bp
from auth import is_admin, current_admin, login as admin_login

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


class NumpyJSONProvider(DefaultJSONProvider):
    def default(self, o):
        if isinstance(o, np.integer):
            return int(o)
        if isinstance(o, np.floating):
            return float(o)
        if isinstance(o, np.ndarray):
            return o.tolist()
        return super().default(o)


app = Flask(__name__)
app.json = NumpyJSONProvider(app)

app.register_blueprint(finance_bp)
app.register_blueprint(perf_bp)
app.register_blueprint(kpi_bp)
app.register_blueprint(download_bp)
app.register_blueprint(ai_bp)


@app.route("/api/data-health")
def api_data_health():
    """KPI/재무 데이터가 같은 PPT 파일을 각자 독립적으로 스캔한다 — 그 파일에서 뽑힌
    프로젝트코드 집합이 KPI 쪽과 재무 쪽에서 서로 다르면 오입력 후보로 본다.
    (한 파일에 프로젝트가 여러 개면 집합 전체가 같은지만 보므로 개수는 무관하게 맞음/틀림 판정)

    둘 다 정식 코드 형식이 아닌 값끼리만 다른 경우(예: "0" vs "-", "코드 생성 예정" 류)는
    실제 오류가 아니라 placeholder 문구 차이일 뿐이라 제외 — 정식 코드가 한쪽이라도
    있는데 서로 안 맞을 때만 경고 대상으로 남긴다.
    """
    fin_df = get_df()
    kpi_df = get_kpi_df()
    if fin_df.empty or kpi_df.empty:
        return jsonify({"count": 0, "rows": []})

    kpi_code_col = next((c for c in kpi_df.columns if "프로젝트코드" in str(c)), None)
    kpi_file_col = next((c for c in kpi_df.columns if "파일명" in str(c)), None)
    if kpi_code_col is None or kpi_file_col is None:
        return jsonify({"count": 0, "rows": []})

    fin_by_file = fin_df.groupby("filename")["project_code"].apply(
        lambda s: frozenset(str(x).strip() for x in s)
    )
    kpi_by_file = kpi_df.groupby(kpi_file_col)[kpi_code_col].apply(
        lambda s: frozenset(str(x).strip() for x in s)
    )

    rows = []
    for f in set(fin_by_file.index) & set(kpi_by_file.index):
        fset, kset = fin_by_file[f], kpi_by_file[f]
        if fset == kset:
            continue
        if not any(_real_code(c) for c in fset | kset):
            continue  # 둘 다 placeholder일 때만 다름 — 실제 오류 아님
        rows.append({
            "file": f,
            "finance_codes": sorted(fset),
            "kpi_codes": sorted(kset),
        })

    conflicts, read_failures = _read_code_conflicts()
    # 같은 프로젝트가 단계별로 재보고된 것으로 판정된 건(likely_same_project)은 문제 아님 — 응답에서 뺌(2026-10-06)
    conflicts = [c for c in conflicts if c["verdict"] != "likely_same_project"]
    finished_anomalies = _read_finished_report_anomalies(fin_df)
    return jsonify({
        "count": len(rows) + len(conflicts) + len(finished_anomalies) + len(read_failures),
        "rows": rows,
        "conflicts": conflicts,
        "finished_anomalies": finished_anomalies,
        # 코드충돌 시트를 COM으로도 못 읽은 쪽 — "충돌 0건"과 "읽지 못해 모름"을 화면에서 구분
        "read_failures": read_failures,
    })


_FINISHED_ANOMALY_COLS = {
    "expenditure":      "지출",
    "labor_cost":       "직접 인건비",
    "overhead":         "공통원가/관리비",
    "operating_profit": "경상 이익",
    "profit_rate":      "이익율",
}


def _read_finished_report_anomalies(fin_df):
    """"완료" 단계 보고서는 매출·직접원가 외(지출/인건비/공통원가/경상이익/이익율)는 PPT
    양식상 원래 안 채우는 게 정책(2026-09-21 담당자 결정) — 그런데 값이 들어있으면 PPT가
    아직 안 고쳐졌거나 오입력일 가능성이 높아 확인 대상으로 노출한다."""
    if fin_df.empty or "stage" not in fin_df.columns:
        return []
    done = fin_df[fin_df["stage"].astype(str).str.strip() == "완료"]
    if done.empty:
        return []
    cols = list(_FINISHED_ANOMALY_COLS.keys())
    mask = (done[cols] != 0).any(axis=1)
    rows = []
    for _, r in done[mask].iterrows():
        fields = [
            {"label": label, "value": float(r[col])}
            for col, label in _FINISHED_ANOMALY_COLS.items()
            if r[col]
        ]
        if not fields:
            continue
        rows.append({
            "project_code": str(r.get("project_code", "")).strip(),
            "part":         str(r.get("part", "")).strip(),
            "filename":     str(r.get("filename", "")).strip(),
            "fields":       fields,
        })
    return rows


def _classify_conflict(code: str, fin_df, kpi_df, kpi_code_col: str, kpi_part_col: str):
    """코드충돌 1건이 '진짜 다른 프로젝트 충돌'인지 '한 파일에 여러 프로젝트가 있고 배치
    보고서 제목만 단계마다 바뀐 것'(정상)인지 자동 판별.

    2026-09-21: E040600126050001/E069600126050001("매치업" 계열) 사례를 사람이 직접
    파트·금액·비고를 대조해 오탐으로 판정했던 근거를 규칙화 — 같은 코드로 취합 시트에 남은
    모든 행이 파트도 같고 매출 금액도 서로 크게 다르지 않으면(배수 1.5배 이내) 같은 프로젝트가
    단계별로 재보고된 것으로 보고 "likely_same_project", 아니면 "needs_review"로 표시.
    파트가 갈리거나 금액이 크게 벌어지면 진짜 다른 프로젝트가 코드만 겹쳤을 가능성이 높음.
    """
    fin_rows = fin_df[fin_df["project_code"].astype(str).str.strip() == code]
    if not fin_rows.empty:
        parts = set(fin_rows["part"].astype(str).str.strip())
        if len(parts) > 1:
            return "needs_review", f"재무 취합에서 파트가 서로 다름: {sorted(parts)}"
        revenues = [v for v in fin_rows["revenue"].tolist() if v and v > 0]
        if revenues:
            lo, hi = min(revenues), max(revenues)
            if hi / lo > 1.5:
                return "needs_review", f"재무 매출 금액 차이가 큼: {lo:,.0f}원 ~ {hi:,.0f}원"
        return "likely_same_project", "재무 취합 기준 파트·매출 금액이 파일 간 일관됨"

    if kpi_code_col and kpi_part_col:
        kpi_rows = kpi_df[kpi_df[kpi_code_col].astype(str).str.strip() == code]
        if not kpi_rows.empty:
            parts = set(kpi_rows[kpi_part_col].astype(str).str.strip())
            if len(parts) > 1:
                return "needs_review", f"KPI 취합에서 파트가 서로 다름: {sorted(parts)}"
            return "likely_same_project", "KPI 취합 기준 파트가 파일 간 일관됨"

    return "needs_review", "취합 시트에서 해당 코드를 찾을 수 없음 — 직접 확인 필요"


# (경로 → (mtime, 행 목록)) — AIP 암호화 파일은 Excel COM으로 읽어 수 초가 걸리는데 data-health는
# 클라이언트마다 5분 주기로 불리므로, 파일이 바뀌었을 때만 다시 읽는다
_conflict_sheet_cache: dict = {}


def _read_conflict_sheet(path):
    """추출 엑셀의 '코드충돌' 시트 데이터 행(헤더 제외)을 튜플 목록으로. 읽기 실패면 None.

    출력 xlsx를 Excel로 한 번 열면 회사 AIP 레이블이 붙어 암호화되는데, 예전엔 openpyxl 실패를
    조용히 넘겨서 충돌이 있어도 0건 → Navbar "!" 배지가 소리 없이 사라졌음(2026-09-28 발견).
    이제 암호화면 finance/kpi 본 데이터와 같이 Excel COM으로 우회하고, 그래도 실패하면 경고 로그.
    """
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return []
    cached = _conflict_sheet_cache.get(path)
    if cached and cached[0] == mtime:
        return cached[1]

    rows = None
    try:
        wb = load_workbook(path, data_only=True, read_only=True)
        try:
            rows = ([tuple(r) for r in wb["코드충돌"].iter_rows(min_row=2, values_only=True)]
                    if "코드충돌" in wb.sheetnames else [])
        finally:
            wb.close()
    except Exception as e:
        logger.warning("코드충돌 시트 openpyxl 읽기 실패(AIP 암호화 추정) — Excel COM으로 재시도: %s (%s)", path, e)
        df = _read_excel_via_com(path, "코드충돌")
        if df is not None:
            rows = [tuple(r) for r in df.itertuples(index=False, name=None)]

    if rows is None:
        # 캐시하지 않음 — 다음 호출에 다시 시도(일시적 COM 실패일 수 있음)
        logger.warning("코드충돌 시트를 읽지 못함 — 데이터 이상 배지에 '읽기 실패'로 표시: %s", path)
        return None
    _conflict_sheet_cache[path] = (mtime, rows)
    return rows


def _read_code_conflicts():
    """추출 스크립트가 남긴 '코드충돌' 시트를 읽어 합치고, 각 건을 자동 분류해서 반환.

    서로 다른 PPT가 같은 (코드/연도/단계) 키를 공유하면 뒤에 처리된 파일이 앞 파일의 행을
    덮어써서, **덮어써진 쪽은 취합 시트에 자기 파일명으로 된 행이 아예 안 남는다.**
    위 불일치 검사는 '같은 파일명에 재무·KPI 양쪽 데이터가 있을 때'만 비교하므로 이 경우를
    통째로 놓친다(2026-09-17 실제로 놓친 사례 발견) — 그래서 추출 시점에 기록해둔 충돌을
    여기서 함께 노출한다.

    ⚠️ 파일명 비교만으로는 "한 파일에 여러 프로젝트 + 단계마다 배치 제목이 바뀌는" 케이스를
    구분 못 함(2026-09-18/21 발견, memory: kpi-finance-code-conflict-batch-file-limit) —
    그래서 각 건을 _classify_conflict()로 한 번 더 걸러 verdict를 붙인다.
    """
    # 충돌은 A→B, B→A 양방향으로 기록되므로 (소스, 코드) 단위로 묶어 관련 파일 집합만 남긴다
    grouped = {}
    read_failures = []
    for source, path in (("재무", EXCEL_PATH), ("KPI", KPI_EXCEL_PATH)):
        sheet_rows = _read_conflict_sheet(path)
        if sheet_rows is None:
            read_failures.append({"source": source, "file": os.path.basename(str(path))})
            continue
        for r in sheet_rows:
            if not r or not r[0]:
                continue
            # 재무는 (코드,연도,파트,구분,기존,신규,발견일시) / KPI는 (코드,연도,단계,기존,신규,발견일시)
            existing, new = (r[4], r[5]) if source == "재무" else (r[3], r[4])
            entry = grouped.setdefault((source, str(r[0])), {
                "source": source, "code": str(r[0]), "files": [],
            })
            for f in (existing, new):
                f = str(f or "").strip()
                if f and f not in entry["files"]:
                    entry["files"].append(f)

    fin_df = get_df()
    kpi_df = get_kpi_df()

    # 허용: 같은 코드의 "추가" 단계(추가제안·추가중간·추가완료) 보고서 — 기존 프로젝트의 추가분이라 같은 코드를
    # 쓰는 게 정상(2026-09-29, 해외연구소 펀더멘털/추가개발 사례). 재무 추출은 PPT 안 단계를 읽어 "추가제안"으로
    # 구분하지만 KPI 추출은 파일명(_제안)으로 단계를 정해 둘이 같은 키가 되며 충돌로 기록됨 → 표시 단계에서 제외
    if not fin_df.empty and "stage" in fin_df.columns:
        extra_files = set(
            fin_df.loc[fin_df["stage"].astype(str).str.startswith("추가"), "filename"].astype(str).str.strip()
        )
        grouped = {k: e for k, e in grouped.items() if not any(f in extra_files for f in e["files"])}

    kpi_code_col = next((c for c in kpi_df.columns if "프로젝트코드" in str(c)), None) if not kpi_df.empty else None
    kpi_part_col = next((c for c in kpi_df.columns if "파트명" in str(c)), None) if not kpi_df.empty else None
    for entry in grouped.values():
        verdict, reason = _classify_conflict(entry["code"], fin_df, kpi_df, kpi_code_col, kpi_part_col)
        entry["verdict"] = verdict
        entry["reason"] = reason

    # needs_review를 먼저 보여주고, 그다음 파일 개수 많은 순
    return sorted(
        grouped.values(),
        key=lambda e: (e["verdict"] != "needs_review", -len(e["files"]), e["code"]),
    ), read_failures


# ── PPT 데이터 추출(Navbar ⚙ → PPT 데이터 추출) ──────────────────────────
# scripts/extract_*.py를 subprocess로 돌리는 것 자체는 dashboard_update.py와 동일 패턴이지만,
# 웹 요청은 30분씩 블로킹할 수 없어 백그라운드 스레드로 돌리고 상태를 폴링하게 한다.
_EXTRACT_SCRIPTS = {
    "finance": "extract_financial_ppt.py",
    "kpi":     "extract_kpi_ppt.py",
}
_EXTRACT_MODES = {"incremental", "force", "reset", "failed"}
# Navbar에서 "PPT 데이터 추출" 자체를 보이게/실행 가능하게 하는 공용 키 — 아직 배포 전이라
# LAN에 공유돼도 아무나 못 누르게(2026-09-23, 본인+책임님만 권한). 비어있으면 무조건 거부(안전 기본값)
EXTRACT_ADMIN_KEY = os.environ.get("EXTRACT_ADMIN_KEY", "").strip()
_extract_lock = threading.Lock()
_extract_status = {
    "running": False, "targets": [], "mode": None, "started_by": None,
    "started_at": None, "finished_at": None, "ok": None, "message": "", "cancelled": False,
}
_extract_proc = None            # 현재 실행 중인 subprocess.Popen (중지 버튼이 여길 찾아서 terminate)
_extract_cancel_requested = False


def _extract_key_valid(req) -> bool:
    """관리자 로그인 토큰 확인(auth.py) — 예전 공용 키(EXTRACT_ADMIN_KEY)는 이제 토큰 서명에만 씀(2026-10-06)."""
    return is_admin(req)


def _run_extract_script(name: str, mode: str, only_list: "str | None" = None) -> tuple[bool, str]:
    """Popen으로 돌려서 핸들을 _extract_proc에 남겨야 '중지' 버튼이 해당 프로세스를 찾아 죽일 수 있음.
    스크립트는 파일 하나 처리 시작 시점 외에는 wb.save()를 거의 안 부르고(cleanup 직후 1회,
    전체 완료/예외 시 finally에서 1회뿐) 대부분의 시간을 PowerPoint COM 호출에 쓰므로,
    terminate()가 save() 도중을 때릴 확률은 낮다 — 하지만 COM이 띄운 POWERPNT.EXE는 이 프로세스의
    자식이라 terminate만으론 안 죽을 수 있어(좀비 프로세스, known-issues 참고) 상태 메시지로 안내한다."""
    global _extract_proc
    script = Path(__file__).parent / "scripts" / _EXTRACT_SCRIPTS[name]
    python = os.environ.get("PYTHON_EXE", "").strip() or sys.executable
    # FORCE_REPROCESS/RESET_OUTPUT_ON_START는 스크립트 전역 상수 기본값(False)을 env var로만
    # 덮어씀 — os.environ을 직접 건드리지 않고 이 subprocess에만 넘겨서 다른 요청에 영향 없음
    env = os.environ.copy()
    env["FORCE_REPROCESS"] = "1" if mode in ("force", "reset") else "0"
    env["RESET_OUTPUT_ON_START"] = "1" if mode == "reset" else "0"
    # mode=failed: 스크립트가 이 목록 파일에 적힌 경로만 처리(부분 실행 — 정리 단계 건너뜀)
    env.pop("EXTRACT_ONLY_LIST", None)
    if only_list:
        env["EXTRACT_ONLY_LIST"] = only_list

    proc = subprocess.Popen(
        [python, str(script)],
        cwd=str(Path(__file__).parent),
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, encoding="utf-8", errors="replace",
        env=env,
    )
    with _extract_lock:
        _extract_proc = proc

    try:
        stdout, stderr = proc.communicate(timeout=1800)  # dashboard_update.py와 동일(대량 재수정 대비)
    except subprocess.TimeoutExpired:
        proc.kill()
        stdout, stderr = proc.communicate()
        return False, f"{name} 추출이 30분을 넘겨 중단됐습니다"
    finally:
        with _extract_lock:
            _extract_proc = None

    if _extract_cancel_requested:
        return False, "__CANCELLED__"

    tail = (stdout or "")[-800:]
    if stderr:
        tail += "\n" + stderr[-400:]
    if proc.returncode != 0:
        return False, f"exit {proc.returncode}\n{tail}"
    return True, tail


def _write_failed_list(target: str) -> "tuple[str | None, str]":
    """mode=failed — 추출 현황에서 '실패'인 파일 경로를 임시 목록 파일로. (목록 경로 또는 None, 안내 문구)
    DRM 파일도 포함 — 추출 스크립트가 원본 대신 로컬 사본을 열어 시도"""
    import tempfile
    from extract_coverage import failed_paths
    paths_, drm = failed_paths(target)
    note = f"DRM 파일 {len(drm)}개는 로컬 사본으로 시도: {', '.join(drm)}" if drm else ""
    if not paths_:
        return None, note
    fd, list_path = tempfile.mkstemp(suffix=".txt", prefix=f"extract_failed_{target}_")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write("\n".join(paths_) + "\n")
    return list_path, f"실패 파일 {len(paths_)}개 다시 추출" + (f" · {note}" if note else "")


def _extract_job(targets: list, mode: str):
    global _extract_cancel_requested
    logs = []
    ok_all = True
    cancelled = False
    for t in targets:
        if mode == "failed":
            list_path, note = _write_failed_list(t)
            if list_path is None:
                logs.append(f"[{t}] 다시 추출할 실패 파일 없음" + (f" — {note}" if note else ""))
                continue
            try:
                ok, msg = _run_extract_script(t, mode, list_path)
            finally:
                try:
                    os.remove(list_path)
                except OSError:
                    pass
            msg = f"{note}\n{msg}"
        else:
            ok, msg = _run_extract_script(t, mode)
        if msg == "__CANCELLED__":
            cancelled = True
            logs.append(f"[{t}] 사용자가 중지함 — 마지막으로 저장된 지점까지만 반영됨")
            ok_all = False
            break
        logs.append(f"[{t}] {'완료' if ok else '실패'}\n{msg}")
        ok_all = ok_all and ok
        if not ok:
            break  # 하나 실패하면 이어서 돌리지 않음(재무 실패했는데 KPI만 계속 도는 건 의미 없음)

    if cancelled:
        logs.append("[안내] PowerPoint가 자동화로 켜져 있었다면 작업 관리자에서 POWERPNT.EXE가 남아있는지 확인하세요.")

    if ok_all:
        try:
            if "finance" in targets:
                with _cache_lock:
                    load_excel()
            if "kpi" in targets:
                with _kpi_cache_lock:
                    load_kpi_excel()
        except Exception as e:
            ok_all = False
            logs.append(f"[캐시 갱신] 실패: {e}")

    with _extract_lock:
        _extract_cancel_requested = False
        _extract_status.update({
            "running": False,
            "finished_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "ok": ok_all,
            "message": "\n\n".join(logs),
            "cancelled": cancelled,
        })


@app.route("/api/auth/login", methods=["POST"])
def api_auth_login():
    """사번·비밀번호 확인 — 통과하면 토큰을 내려주고 프론트가 localStorage에 저장해 이후 요청 헤더로 실어보냄."""
    body = request.get_json(silent=True) or {}
    result = admin_login(str(body.get("emp_no", "")).strip(), str(body.get("password", "")))
    if not result:
        return jsonify({"ok": False}), 401
    logger.info("[관리자 로그인] %s(%s)", result["name"], result["emp_no"])
    return jsonify({"ok": True, **result})


@app.route("/api/auth/me")
def api_auth_me():
    """저장된 토큰이 아직 유효한지 — 계정이 지워졌거나 비밀번호가 바뀌었으면 ok:false(프론트가 로그아웃 처리)."""
    admin = current_admin(request)
    return jsonify({"ok": True, **admin} if admin else {"ok": False})


@app.route("/api/extract/run", methods=["POST"])
def api_extract_run():
    if not _extract_key_valid(request):
        return jsonify({"ok": False, "error": "권한이 없습니다"}), 403

    body = request.get_json(silent=True) or {}
    targets = [t for t in body.get("targets", []) if t in _EXTRACT_SCRIPTS]
    mode = body.get("mode", "incremental")
    # 실행자 이름은 로그인한 계정 기준(예전엔 브라우저가 보낸 이름)
    started_by = (current_admin(request) or {}).get("name") or "알 수 없음"
    if not targets:
        return jsonify({"ok": False, "error": "targets가 비어있습니다"}), 400
    if mode not in _EXTRACT_MODES:
        return jsonify({"ok": False, "error": "mode 값이 올바르지 않습니다"}), 400

    with _extract_lock:
        if _extract_status["running"]:
            # 책임님/본인 등 누가 지금 돌리고 있는지 보여줘서 "왜 안 눌리지"가 아니라
            # "아 지금 누가 쓰고 있구나"로 바로 알 수 있게(파일 바로가기의 동시열기 차단과 동일 원칙)
            return jsonify({
                "ok": False,
                "error": f"{_extract_status['started_by']}님이 이미 추출을 실행 중입니다",
            }), 409
        _extract_status.update({
            "running": True, "targets": targets, "mode": mode, "started_by": started_by,
            "started_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "finished_at": None, "ok": None, "message": "", "cancelled": False,
        })

    threading.Thread(target=_extract_job, args=(targets, mode), daemon=True).start()
    return jsonify({"ok": True, "started": True})


@app.route("/api/extract/cancel", methods=["POST"])
def api_extract_cancel():
    """진행 중인 추출을 중지. wb.save()는 파일 처리 루프 안에서 거의 안 불려서(위 주석 참고)
    거의 항상 '마지막 저장 시점까지'만 보존되고 파일이 깨지진 않지만, PowerPoint COM이 띄운
    POWERPNT.EXE는 자식 프로세스라 안 죽을 수 있어 100% 안전 보장은 아님."""
    if not _extract_key_valid(request):
        return jsonify({"ok": False, "error": "권한이 없습니다"}), 403

    global _extract_cancel_requested
    with _extract_lock:
        if not _extract_status["running"] or _extract_proc is None:
            return jsonify({"ok": False, "error": "진행 중인 추출이 없습니다"}), 409
        _extract_cancel_requested = True
        proc = _extract_proc
    try:
        proc.terminate()
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500
    return jsonify({"ok": True})


@app.route("/api/extract/status")
def api_extract_status():
    with _extract_lock:
        body = dict(_extract_status)
    # 마지막 추출 시각 — finished_at은 서버 메모리라 재시작하면 비어서, 결과 엑셀(재무·KPI)이 마지막으로 저장된 시각을
    # 따로 줌(관리자 기능 "PPT 데이터 추출" 제목 오른쪽, 2026-10-06)
    from shared import safe_mtime
    mt = max((safe_mtime(p) or 0) for p in (EXCEL_PATH, KPI_EXCEL_PATH))
    body["last_extracted_at"] = datetime.fromtimestamp(mt).strftime("%Y-%m-%d %H:%M") if mt else None
    return jsonify(body)


@app.route("/api/extract/coverage")
def api_extract_coverage():
    """추출 현황 — NAS 폴더의 PPT 파일 수 vs 실제로 추출된 파일, 안 된 파일과 이유(관리자용 기능 모달).
    파일 이름 목록이 나가므로 관리자 키 필요. ?refresh=1이면 30초 캐시 무시하고 폴더를 다시 훑음"""
    if not _extract_key_valid(request):
        return jsonify({"ok": False, "error": "권한이 없습니다"}), 403
    import extract_coverage
    try:
        return jsonify(extract_coverage.coverage(force=request.args.get("refresh") == "1"))
    except Exception as e:
        logger.exception("추출 현황 계산 실패")
        return jsonify({"ok": False, "error": str(e)}), 500


# ── 화면 공개 범위(관리자용 기능 모달) ─────────────────────────────────────
# 예전엔 브라우저마다 localStorage에 저장돼 관리자가 바꿔도 자기 화면에만 적용됐음 →
# 서버 파일 하나에 두고 모든 화면이 같은 값을 읽음(2026-10-06). 노출만 관리 — API 접근 자체는 막지 않음.
# all 전체 / admin 관리자 인증한 브라우저만 / none 아무도
_VISIBILITY_PATH = Path(__file__).parent / "data" / "visibility.json"
_VISIBILITY_DEFAULTS = {"fileOpen": "admin", "achieveRate": "none"}
# 달성률은 '전체' 없음 — 저조한 팀이 모두에게 드러나지 않게(2026-09-29 원칙)
_VISIBILITY_CHOICES = {"fileOpen": {"all", "admin", "none"}, "achieveRate": {"admin", "none"}}
_visibility_lock = threading.Lock()


def _read_visibility() -> dict:
    import json
    out = dict(_VISIBILITY_DEFAULTS)
    try:
        saved = json.loads(_VISIBILITY_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return out
    except Exception:
        logger.warning("공개 범위 설정 파일을 못 읽음 — 기본값 사용: %s", _VISIBILITY_PATH)
        return out
    for k, choices in _VISIBILITY_CHOICES.items():
        if saved.get(k) in choices:
            out[k] = saved[k]
    return out


@app.route("/api/settings/visibility")
def api_get_visibility():
    with _visibility_lock:
        return jsonify(_read_visibility())


@app.route("/api/settings/visibility", methods=["PUT"])
def api_put_visibility():
    if not _extract_key_valid(request):
        return jsonify({"ok": False, "error": "권한이 없습니다"}), 403
    import json
    body = request.get_json(silent=True) or {}
    with _visibility_lock:
        cur = _read_visibility()
        for k, v in body.items():
            if k not in _VISIBILITY_CHOICES or v not in _VISIBILITY_CHOICES[k]:
                return jsonify({"ok": False, "error": f"잘못된 값: {k}={v}"}), 400
            cur[k] = v
        # 임시 파일에 쓰고 바꿔치기 — 쓰다 끊겨도 파일이 반쯤 깨진 채 남지 않게
        _VISIBILITY_PATH.parent.mkdir(exist_ok=True)
        tmp = _VISIBILITY_PATH.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(cur, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, _VISIBILITY_PATH)
    logger.info("[공개 범위] 변경 %s -> %s", body, cur)
    return jsonify(cur)


@app.route("/api/extract/open-file", methods=["POST"])
def api_extract_open_file():
    """추출 현황 목록의 원본 PPT 열기(↗). 미처리·실패 파일은 처리이력에 경로가 없어 재무/KPI 열기 API로는
    못 찾음 → 추출 현황이 폴더를 훑으며 찾은 경로로 연다. 목록에 있는 파일만(임의 경로 X), 관리자 키 필요"""
    if not _extract_key_valid(request):
        return jsonify({"ok": False, "message": "권한이 없습니다"}), 403
    import extract_coverage
    from shared import open_source_file
    data = request.get_json(silent=True) or {}
    filename = str(data.get("filename", "")).strip()
    if not filename:
        return jsonify({"ok": False, "message": "파일명이 없습니다."}), 400
    path = extract_coverage.find_path(filename)
    logger.info("[파일 열기/추출 현황] filename=%s -> path=%s", filename, path)
    body, status = open_source_file(path, check_only=bool(data.get("check")), folder=bool(data.get("folder")))
    return jsonify(body), status


if __name__ == "__main__":
    with _cache_lock:
        load_excel()
    try:
        from waitress import serve
        print("서버 시작: http://0.0.0.0:5000")
        serve(app, host="0.0.0.0", port=5000, threads=4)
    except ImportError:
        app.run(host="0.0.0.0", port=5000, debug=False)
