import logging
import os
import subprocess
import sys
import threading
from datetime import datetime
from pathlib import Path

import numpy as np
import ipaddress
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException, InternalServerError
from flask.json.provider import DefaultJSONProvider
from openpyxl import load_workbook

from finance import finance_bp, get_df, load_excel, _cache_lock, EXCEL_PATH, _read_excel_via_com
import headcount
from performance import perf_bp
from kpi import kpi_bp, get_kpi_df, _real_code, KPI_EXCEL_PATH, load_kpi_excel, _kpi_cache_lock
from downloads import download_bp
from ai_insight import ai_bp
from extract_requests import request_bp
from secret_mail import secret_mail_bp
from auth import (
    is_admin, current_admin, current_user, login as admin_login, login_required_for_api,
    login_required as _login_required, set_login_required,
)

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

# 들어가자마자 로그인(2026-10-13) — 10-14 잠깐 껐다가 10-15 다시 켬. 끌 땐 아래 줄 주석 +
# frontend/src/utils/authMode.ts LOGIN_REQUIRED = false. 관리자 API(@admin_required·_extract_key_valid)는 그대로 403
app.before_request(login_required_for_api)   # 로그인 요구는 관리자 기능 토글(data/access.json)로 켜고 끔(2026-10-22) — 코드 주석 처리 불필요
app.register_blueprint(finance_bp)
app.register_blueprint(perf_bp)
app.register_blueprint(kpi_bp)
app.register_blueprint(download_bp)
app.register_blueprint(ai_bp)
app.register_blueprint(request_bp)
app.register_blueprint(secret_mail_bp)


# /api/* 오류는 HTML 오류 페이지·스택트레이스 대신 항상 {ok:false, error} JSON으로(2026-11-04) — 프론트·추출 스크립트가
# 같은 모양으로 읽고, 내부 정보(경로·예외 문구)가 응답에 안 섞이게. 상세는 로그에만 남김. /api/ 밖 경로는 기존 동작 그대로
_HTTP_ERROR_TEXT = {
    400: "잘못된 요청입니다",
    404: "찾을 수 없는 주소입니다",
    405: "허용되지 않는 요청 방식입니다",
    413: "요청 내용이 너무 큽니다",
    415: "지원하지 않는 요청 형식입니다",
}


@app.errorhandler(HTTPException)
def _handle_http_error(e: HTTPException):
    if not request.path.startswith("/api/"):
        return e
    code = e.code or 500
    resp = jsonify({"ok": False, "error": _HTTP_ERROR_TEXT.get(code, "요청을 처리할 수 없습니다")})
    resp.status_code = code
    if code == 405 and getattr(e, "valid_methods", None):
        resp.headers["Allow"] = ", ".join(e.valid_methods)
    return resp


@app.errorhandler(Exception)
def _handle_unexpected_error(e: Exception):
    logger.exception("처리 중 예외: %s %s", request.method, request.path)
    if not request.path.startswith("/api/"):
        return InternalServerError()
    resp = jsonify({"ok": False, "error": "서버 내부 오류가 발생했습니다"})
    resp.status_code = 500
    return resp



def _empty_health() -> dict:
    """비교할 데이터가 없을 때(재무·KPI 중 한쪽이 비었거나 열을 못 찾음)의 응답 — 정상 응답과 **같은 키 집합**(값은 빈 목록·0).
    예전엔 {count, rows}만 줘서 프론트가 conflicts·acks 등 누락 키를 읽다 깨질 수 있었음(2026-11-04)"""
    return {"acks": _valid_health_acks(), "count": 0, "rows": [], "conflicts": [],
            "finished_anomalies": [], "read_failures": [], "excepted": []}


def _collect_health():
    """데이터 이상 후보를 전부(관리자 기준 — '생성 예정' 참고 건 포함) 모음. 비교할 데이터가 없으면 None.
    → (rows, conflicts, finished_anomalies, read_failures). 요청자별 숨김·예외 처리는 호출하는 쪽에서"""
    fin_df = get_df()
    kpi_df = get_kpi_df()
    if fin_df.empty or kpi_df.empty:
        return None

    kpi_code_col = next((c for c in kpi_df.columns if "프로젝트코드" in str(c)), None)
    kpi_file_col = next((c for c in kpi_df.columns if "파일명" in str(c)), None)
    if kpi_code_col is None or kpi_file_col is None:
        return None

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
        # 한쪽이 아직 코드 미발급("생성예정"·"생성 예정"·"(생성 필요)")이면 오류가 아님 — 관리자에게만 참고로 보임(응답 단계에서 거름)
        # (10-19 처음엔 아예 뺐다가 같은 날 "관리자만 볼 수 있게"로 변경)
        rows.append({
            "file": f,
            "finance_codes": sorted(fset),
            "kpi_codes": sorted(kset),
            "pending": _all_pending_code(fset) or _all_pending_code(kset),
        })

    conflicts, read_failures = _read_code_conflicts()
    # 같은 프로젝트가 단계별로 재보고된 것으로 판정된 건(likely_same_project)은 문제 아님 — 응답에서 뺌(2026-10-06)
    conflicts = [c for c in conflicts if c["verdict"] != "likely_same_project"]
    # 코드 자체가 '생성 예정'류(아직 미발급)인 충돌은 서로 다른 프로젝트가 같은 문구를 쓴 것뿐 — 오류 아님, 관리자에게만(2026-10-19)
    for c in conflicts:
        c["pending"] = _all_pending_code([c["code"]])
    return rows, conflicts, _read_finished_report_anomalies(fin_df), read_failures


@app.route("/api/data-health")
def api_data_health():
    """KPI/재무 데이터가 같은 PPT 파일을 각자 독립적으로 스캔한다 — 그 파일에서 뽑힌
    프로젝트코드 집합이 KPI 쪽과 재무 쪽에서 서로 다르면 오입력 후보로 본다.
    (한 파일에 프로젝트가 여러 개면 집합 전체가 같은지만 보므로 개수는 무관하게 맞음/틀림 판정)

    둘 다 정식 코드 형식이 아닌 값끼리만 다른 경우(예: "0" vs "-", "코드 생성 예정" 류)는
    실제 오류가 아니라 placeholder 문구 차이일 뿐이라 제외 — 정식 코드가 한쪽이라도
    있는데 서로 안 맞을 때만 경고 대상으로 남긴다.

    관리자가 '예외 처리'한 파일의 이상은 빨간 "!"(rows·conflicts·finished_anomalies·count)에서 빠지고,
    관리자 응답의 `excepted`에만 남는다(2026-11-10)
    """
    collected = _collect_health()
    if collected is None:
        return jsonify(_empty_health())
    rows, conflicts, anomalies, read_failures = collected
    admin = is_admin()

    # 관리자 예외 처리 — 이상의 '내용'이 예외 처리할 때와 같을 때만 적용(내용이 바뀌면 자동으로 풀려 다시 "!")
    issue_map = _issue_map(rows, conflicts, anomalies)
    active = _apply_health_exceptions(issue_map, can_prune=not read_failures)
    hidden = lambda files: bool(files) and all(f in active for f in files)   # noqa: E731
    rows = [r for r in rows if not hidden([r["file"]])]
    conflicts = [c for c in conflicts if not hidden(c["files"])]
    anomalies = [a for a in anomalies if not hidden([a["filename"]])]
    excepted = [
        {"file": f, "issues": [text for _, text in issue_map[f]], "by": exc.get("by", ""), "at": exc.get("at", ""),
         "reason": exc.get("reason", "")}
        for f, exc in sorted(active.items())
    ] if admin else []

    if not admin:   # 참고용('생성 예정') 건은 관리자에게만
        rows = [r for r in rows if not r["pending"]]
        conflicts = [c for c in conflicts if not c["pending"]]
    return jsonify({
        "acks": _valid_health_acks(),
        "count": len(rows) + len(conflicts) + len(anomalies) + len(read_failures),
        "rows": rows,
        "conflicts": conflicts,
        "finished_anomalies": anomalies,
        # 코드충돌 시트를 COM으로도 못 읽은 쪽 — "충돌 0건"과 "읽지 못해 모름"을 화면에서 구분
        "read_failures": read_failures,
        "excepted": excepted,
    })


# ── 데이터 이상 "관리자 예외 처리"(2026-11-10) ───────────────────────────────────────────
# 한 파일에 프로젝트 코드가 둘인데 KPI는 하나인 것처럼 '의도한' 불일치를 관리자가 빨간 "!"에서 뺄 수 있게.
# · 관리자만 처리·해제. 처리하면 모든 사람 화면에서 그 파일의 이상이 "!"에서 빠지고, 관리자 응답(excepted)에는 남음
# · 예외 처리 때 그 파일의 이상 '내용'(코드 집합·충돌 코드 등)의 서명을 같이 저장 → PPT가 고쳐져 내용이 달라지면
#   서명이 안 맞아 저절로 풀려 다시 "!"(조용히 가려진 채 새 문제가 묻히지 않게). 이상이 사라져도 정리
# · "수정 완료"(담당자가 고쳤다고 표시 — 재추출되면 사라짐)와는 별개
_EXC_PATH = Path(__file__).parent / "data" / "health_exceptions.json"
_exc_lock = threading.Lock()


def _read_health_exceptions() -> dict:
    import json
    try:
        data = json.loads(_EXC_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except Exception:
        logger.warning("예외 처리 파일을 못 읽음 — 무시: %s", _EXC_PATH)
        return {}


def _write_health_exceptions(data: dict) -> None:
    import json
    _EXC_PATH.parent.mkdir(exist_ok=True)
    tmp = _EXC_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, _EXC_PATH)


def _issue_map(rows, conflicts, anomalies) -> dict:
    """파일명 → [(내용 키, 관리자 화면 문구)] — 키는 이상의 내용(예외 처리 서명 재료), 문구는 사람이 읽는 설명"""
    out: dict = {}

    def add(f, key, text):
        out.setdefault(f, []).append((key, text))

    for r in rows:
        add(r["file"], f"row|{'/'.join(r['finance_codes'])}|{'/'.join(r['kpi_codes'])}",
            f"KPI↔재무 코드 불일치: 재무 {', '.join(r['finance_codes']) or '-'} / KPI {', '.join(r['kpi_codes']) or '-'}")
    for c in conflicts:
        files = sorted(c["files"])
        for f in files:
            add(f, f"conflict|{c['source']}|{c['code']}|{'/'.join(files)}",
                f"코드 충돌({c['source']}): {c['code']}")
    for a in anomalies:
        add(a["filename"], f"anomaly|{a['project_code']}|" + ",".join(f"{x['label']}={x['value']}" for x in a["fields"]),
            f"완료보고 이상: {a['project_code']}")
    return out


def _signature(items) -> str:
    import hashlib
    return hashlib.sha1("\n".join(sorted(k for k, _ in items)).encode("utf-8")).hexdigest()[:16]


def _apply_health_exceptions(issue_map: dict, can_prune: bool = True) -> dict:
    """지금도 유효한 예외 처리만 돌려줌(파일명 → 기록). 서명이 달라졌거나 이상이 사라진 건 정리.
    can_prune=False(코드충돌 시트를 못 읽어 이상 목록이 불완전)면 못 찾은 건 지우지 않고 그대로 둠 — 적용도 안 함"""
    with _exc_lock:
        saved = _read_health_exceptions()
        if not saved:
            return {}
        active, keep = {}, {}
        for f, exc in saved.items():
            items = issue_map.get(f)
            if items and exc.get("sig") == _signature(items):
                active[f] = keep[f] = exc
            elif not can_prune:
                keep[f] = exc
            else:
                logger.info("[데이터 이상] 예외 처리 해제(내용이 바뀌었거나 해소됨): %s", f)
        if keep != saved:
            _write_health_exceptions(keep)
        return active


@app.route("/api/data-health/exception", methods=["POST"])
def api_data_health_exception():
    """**관리자** {files, done, reason?} — done=true면 그 파일들의 지금 이상을 예외 처리(빨간 "!"에서 뺌), false면 해제"""
    if not _extract_key_valid(request):
        return jsonify({"ok": False, "error": "권한이 없습니다"}), 403
    body = request.get_json(silent=True) or {}
    files = [str(f).strip() for f in (body.get("files") or []) if str(f).strip()]
    files = list(dict.fromkeys(files))
    if not files or len(files) > 20 or any(len(f) > 300 for f in files):
        return jsonify({"ok": False, "error": "파일명이 없거나 너무 많습니다"}), 400
    done = bool(body.get("done", True))
    reason = str(body.get("reason") or "").strip()[:200]
    user = current_admin(request) or {}
    who = user.get("name") or user.get("emp_no") or ""

    with _exc_lock:
        saved = _read_health_exceptions()
        if done:
            collected = _collect_health()
            issue_map = _issue_map(*collected[:3]) if collected else {}
            missing = [f for f in files if not issue_map.get(f)]
            if missing:
                return jsonify({"ok": False, "error": f"지금 이상이 없는 파일입니다: {missing[0]}"}), 400
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            for f in files:
                saved[f] = {"sig": _signature(issue_map[f]), "at": now, "by": who, "reason": reason}
        else:
            for f in files:
                saved.pop(f, None)
        _write_health_exceptions(saved)
    logger.info("[데이터 이상] 관리자 예외 처리 %s(%s): %s", "설정" if done else "해제", who, ", ".join(files))
    return jsonify({"ok": True})


# ── 데이터 이상 "수정 완료" 표시(2026-10-20) ──────────────────────────────────────────
# "!" 목록의 파일을 담당자가 PPT에서 고친 뒤 누르면 서버에 남아(다른 PC에서도 보임) 관리자가 재추출할 파일을 알 수 있음.
# 표시 뒤에 그 파일이 다시 추출되면(처리이력 처리일시가 표시 시각보다 늦음) 저절로 없어짐 — 그래도 이상이면 다시 빨간 "!"
_ACK_PATH = Path(__file__).parent / "data" / "health_ack.json"
_ack_lock = threading.Lock()


def _read_health_acks() -> dict:
    import json
    try:
        data = json.loads(_ACK_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except Exception:
        logger.warning("수정 완료 표시 파일을 못 읽음 — 무시: %s", _ACK_PATH)
        return {}


def _write_health_acks(acks: dict) -> None:
    import json
    _ACK_PATH.parent.mkdir(exist_ok=True)
    tmp = _ACK_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(acks, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, _ACK_PATH)


def _valid_health_acks() -> dict:
    """표시 뒤에 다시 추출된 파일은 빼고, 지워진 것은 파일에서도 정리"""
    from extract_coverage import last_processed
    with _ack_lock:
        acks = _read_health_acks()
        if not acks:
            return {}
        try:
            processed = last_processed()
        except Exception:
            logger.exception("처리이력 읽기 실패 — 수정 완료 표시는 그대로 둠")
            return acks
        valid = {f: a for f, a in acks.items() if processed.get(f, "") < str(a.get("at", ""))}
        if len(valid) != len(acks):
            _write_health_acks(valid)
        return valid


@app.route("/api/data-health/ack", methods=["POST"])
def api_data_health_ack():
    """{file, done} — done=true면 '수정 완료' 표시, false면 취소. 로그인했으면 누른 사람 이름(없으면 사번)을 남김"""
    body = request.get_json(silent=True) or {}
    file = str(body.get("file") or "").strip()
    if not file or len(file) > 300:
        return jsonify({"ok": False, "error": "파일명이 없습니다"}), 400
    user = current_user(request)
    with _ack_lock:
        acks = _read_health_acks()
        if body.get("done", True):
            acks[file] = {"at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                          "by": (user.get("name") or user.get("emp_no")) if user else ""}
        else:
            acks.pop(file, None)
        _write_health_acks(acks)
    logger.info("[데이터 이상] 수정 완료 %s: %s", "표시" if body.get("done", True) else "취소", file)
    return jsonify({"ok": True, "acks": acks})


def _all_pending_code(codes):
    """코드 집합이 전부 '생성 예정'류 placeholder인지 — 띄어쓰기·괄호 무관하게 '생성'이 든 값."""
    return bool(codes) and all("생성" in str(c).replace(" ", "") for c in codes)


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

    return "needs_review", "취합 시트에서 해당 코드를 찾을 수 없음. 직접 확인 필요"


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
    # 충돌은 A→B, B→A 양방향으로 기록되므로 코드 단위로 묶어 관련 파일 집합만 남긴다.
    # 재무·KPI가 같은 코드를 각각 기록해 배지에 두 줄로 나오던 것 → 코드당 한 줄, source는 "재무 · KPI"(2026-10-19)
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
            entry = grouped.setdefault(str(r[0]), {
                "source": source, "code": str(r[0]), "files": [], "_sources": [],
            })
            if source not in entry["_sources"]:
                entry["_sources"].append(source)
            for f in (existing, new):
                f = str(f or "").strip()
                if f and f not in entry["files"]:
                    entry["files"].append(f)

    for entry in grouped.values():
        entry["source"] = " · ".join(entry.pop("_sources"))

    # 지금 원본 폴더에 없는 파일(이름 변경·삭제)은 충돌 기록에서 뺌 — 충돌 시트는 추출 때마다 쌓이기만 해서
    # 옛 이름이 계속 보였음(2026-10-19 HDAT 인증평가 사례). 남은 파일이 2개 미만이면 충돌 아님. 폴더에 못 가면 거르지 않음
    from extract_coverage import source_filenames
    current = source_filenames()
    if current is not None:
        for entry in grouped.values():
            entry["files"] = [f for f in entry["files"] if f in current]
        grouped = {k: e for k, e in grouped.items() if len(e["files"]) >= 2}

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
_EXTRACT_MODES = {"incremental", "force", "reset", "failed", "selected"}
_SELECTED_MAX = 300  # mode=selected 한 번에 고를 수 있는 파일 수
# 추출 스크립트 한 번(재무 또는 KPI)의 제한 시간 — 전체(264개)·초기화 추출이 30분을 넘겨 중단됐음(2026-11-06) → 60분.
# ⚠️ 시간 초과로 kill되면 스크립트의 finally(저장)가 안 돌아 그 실행에서 읽은 결과가 통째로 사라짐
_EXTRACT_TIMEOUT_SEC = 3600
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
    # mode=selected: 고른 파일은 그 파일 이름으로 남은 기존 행을 지우고 새로 넣음(덮어쓰기) — 열기 실패한 파일은 안 지움(2026-10-19)
    env["EXTRACT_REPLACE_FILE_ROWS"] = "1" if mode == "selected" else "0"

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
        stdout, stderr = proc.communicate(timeout=_EXTRACT_TIMEOUT_SEC)
    except subprocess.TimeoutExpired:
        proc.kill()
        stdout, stderr = proc.communicate()
        return False, f"{name} 추출이 {_EXTRACT_TIMEOUT_SEC // 60}분을 넘겨 중단됐습니다"
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


def _write_selected_list(target: str, files: list) -> "tuple[str | None, str]":
    """mode=selected — 관리자가 고른 파일명 중 이 추출(재무/KPI)이 대상으로 삼는 것만 전체경로 목록 파일로.
    대상 여부·경로는 추출 현황과 같은 폴더 목록 기준(KPI는 깊이 2까지라 재무에만 있는 파일이 있을 수 있음)"""
    import tempfile
    from extract_coverage import coverage, find_path
    data = coverage(force=True)
    if not data.get("ok") or target not in data:
        return None, data.get("error") or "원본 폴더 목록을 못 읽었습니다"
    names = {it["file"] for it in data[target]["items"]}
    picked = [f for f in files if f in names]
    paths_ = [p for p in (find_path(f) for f in picked) if p]
    skipped = len(files) - len(paths_)
    note = f"이 추출 대상이 아닌 파일 {skipped}개 제외" if skipped else ""
    if not paths_:
        return None, note
    fd, list_path = tempfile.mkstemp(suffix=".txt", prefix=f"extract_selected_{target}_")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write("\n".join(paths_) + "\n")
    return list_path, f"선택한 파일 {len(paths_)}개 다시 추출(덮어쓰기)" + (f" · {note}" if note else "")


def _extract_job(targets: list, mode: str, files: "list | None" = None):
    global _extract_cancel_requested
    logs = []
    ok_all = True
    cancelled = False
    for t in targets:
        if mode in ("failed", "selected"):
            list_path, note = _write_failed_list(t) if mode == "failed" else _write_selected_list(t, files or [])
            if list_path is None:
                what = "실패 파일" if mode == "failed" else "선택한 파일 중 이 추출 대상"
                logs.append(f"[{t}] 다시 추출할 {what} 없음" + (f": {note}" if note else ""))
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
            logs.append(f"[{t}] 사용자가 중지함. 마지막으로 저장된 지점까지만 반영됨")
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

    # 상단 알림 종 배지 — 추출이 끝난(중지·실패 포함, 거기까지 반영된) 지금 추출 현황을 다시 세서 저장(2026-11-06).
    # 예전엔 정해진 시각(기본 08:00)에만 세서, 추출로 다 해결해도 아침의 "99+"가 다음 확인까지 남았음.
    # 상태를 "끝남"으로 바꾸기 전에 해야 화면이 완료를 보고 알림을 다시 불러올 때 새 숫자가 들어 있음(NAS 훑기 6초쯤)
    try:
        import extract_alerts
        extract_alerts.check_now()
    except Exception:   # noqa: BLE001 — 알림 갱신 실패가 추출 결과 표시를 막으면 안 됨
        logger.exception("추출 후 알림 갱신 실패")

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
    logger.info("[로그인] %s(%s) %s", result["name"], result["emp_no"], result["role"])
    return jsonify({"ok": True, **result})


@app.route("/api/auth/me")
def api_auth_me():
    """저장된 토큰이 아직 유효한지 + 역할(admin/user) — 계정이 지워졌거나 비밀번호가 바뀌었으면 ok:false(프론트가 로그아웃 처리)."""
    user = current_user(request)
    return jsonify({"ok": True, **user} if user else {"ok": False})


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
    files = None
    if mode == "selected":
        files = list(dict.fromkeys(str(f).strip() for f in (body.get("files") or []) if str(f).strip()))
        if not files:
            return jsonify({"ok": False, "error": "다시 추출할 파일을 고르세요"}), 400
        if len(files) > _SELECTED_MAX:
            return jsonify({"ok": False, "error": f"한 번에 {_SELECTED_MAX}개까지 고를 수 있습니다"}), 400

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

    threading.Thread(target=_extract_job, args=(targets, mode, files), daemon=True).start()
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
        return jsonify({"ok": False, "error": "관리자만 볼 수 있습니다"}), 403
    import extract_coverage
    try:
        return jsonify(extract_coverage.coverage(force=request.args.get("refresh") == "1"))
    except Exception as e:
        logger.exception("추출 현황 계산 실패")
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/notifications")
def api_notifications():
    """관리자 알림(상단 바 종) — 매일 아침 8시에 센 추출 현황의 '아직 안 읽음·열기 실패·원본 수정됨' 파일 수(extract_alerts.py).
    저장된 값만 돌려줘서 NAS를 훑지 않음. 파일 수만 나가지만 관리자 기능이라 관리자 키 필요"""
    if not _extract_key_valid(request):
        return jsonify({"ok": False, "error": "관리자만 볼 수 있습니다"}), 403
    import extract_alerts
    return jsonify(_alerts_body())


def _alerts_body() -> dict:
    """알림 응답 — 저장된 체크 결과 + 설정(시각·빈도) + 다음 확인 시각(서버가 계산, extract_alerts.next_check)"""
    import extract_alerts
    state, settings = extract_alerts.read(), extract_alerts.read_settings()
    return {"ok": True, **state, "settings": settings,
            "slots": extract_alerts.day_slots(settings),   # 하루에 확인하는 시각 목록(정해진 시각이면 그대로, 일정 간격이면 풀어서)
            "next_check": extract_alerts.next_check(datetime.now(), state, settings)}


@app.route("/api/settings/notifications", methods=["PUT"])
def api_put_notifications_settings():
    """알림 확인 시각·빈도 바꾸기(관리자 기능 > 데이터 > 추출 알림) — 바꾼 항목만 보내면 나머지는 유지.
    `{enabled, days:[0~6, 월=0], mode: times|interval, times:["HH:MM"…≤6], interval_minutes: 30~720, window_start, window_end}`.
    응답은 알림 조회와 같은 모양"""
    if not _extract_key_valid(request):
        return jsonify({"ok": False, "error": "권한이 없습니다"}), 403
    import extract_alerts
    try:
        extract_alerts.write_settings(request.get_json(silent=True) or {})
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    return jsonify(_alerts_body())


# ── 화면 공개 범위(관리자용 기능 모달) ─────────────────────────────────────
# 예전엔 브라우저마다 localStorage에 저장돼 관리자가 바꿔도 자기 화면에만 적용됐음 →
# 서버 파일 하나에 두고 모든 화면이 같은 값을 읽음(2026-10-06). 노출만 관리 — API 접근 자체는 막지 않음.
# all 전체 / admin 관리자 인증한 브라우저만 / none 아무도
_VISIBILITY_PATH = Path(__file__).parent / "data" / "visibility.json"
# folderOpen: 폴더 바로가기 — 파일 바로가기(↗)와 따로(2026-10-20). 기본값은 저장값이 없을 때 예전과 같게 fileOpen 따라감(_read_visibility)
# aiInsight: AI 인사이트 버튼 — 관리자 기능 토글로 켜고 끔(전체/숨김, 2026-10-20). 기본 숨김(10-02부터 숨겨 둔 상태 유지)
_VISIBILITY_DEFAULTS = {"fileOpen": "admin", "folderOpen": "admin", "achieveRate": "none", "aiInsight": "none",
                       "extractRequest": "none",   # extractRequest: 업데이트 요청 버튼 — 전체/관리자/숨김(2026-10-22, 기본 숨김 — 관리자 기능에서 켬)
                       # kpiAnomaly: KPI 탭의 "보고단계가 완료가 아닌데 실적이 이미 입력된 항목 N건" 안내 배너(2026-11-09).
                       # 기존엔 항상 모두에게 보였으므로 기본 전체(저장값이 없어도 예전과 같게). 관리자가 배너의 ×로 닫으면 none(모두에게 숨김),
                       # 관리자 기능 > 화면·접근 > 공개 범위에서 다시 켬
                       "kpiAnomaly": "all"}
# 달성률은 처음엔 '전체'를 막았다가(저조한 팀이 모두에게 드러나지 않게, 2026-09-29) 관리자가 고를 수 있게 열어 둠(2026-10-14 요청).
# 기본값은 그대로 숨김
_VISIBILITY_CHOICES = {"fileOpen": {"all", "admin", "none"}, "folderOpen": {"all", "admin", "none"},
                       "achieveRate": {"all", "admin", "none"}, "aiInsight": {"all", "admin", "none"},
                       "extractRequest": {"all", "admin", "none"}, "kpiAnomaly": {"all", "admin", "none"}}
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
    # folderOpen을 따로 저장한 적 없으면 예전처럼 fileOpen 값을 그대로(갑자기 보이거나 숨지 않게)
    if "folderOpen" not in saved and saved.get("fileOpen") in _VISIBILITY_CHOICES["fileOpen"]:
        out["folderOpen"] = saved["fileOpen"]
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


# ── 로그인 요구 켜기·끄기(관리자 기능 토글, 2026-10-22) ─────────────────────────
# 읽기는 누구나(로그인 화면을 그릴지 정해야 해서 PUBLIC_API), 쓰기는 관리자만. 값이 없으면 켜짐(안전한 쪽)
@app.route("/api/settings/access")
def api_get_access():
    return jsonify({"loginRequired": _login_required()})


@app.route("/api/settings/access", methods=["PUT"])
def api_put_access():
    if not _extract_key_valid(request):
        return jsonify({"ok": False, "error": "권한이 없습니다"}), 403
    body = request.get_json(silent=True) or {}
    if not isinstance(body.get("loginRequired"), bool):
        return jsonify({"ok": False, "error": "loginRequired는 true/false여야 합니다"}), 400
    set_login_required(body["loginRequired"])
    logger.info("[로그인 요구] 변경 -> %s (%s)", body["loginRequired"], (current_admin(request) or {}).get("emp_no"))
    return jsonify({"loginRequired": _login_required()})


# ── 실적 탭 "경영실적 현황 업데이트" 칸(라벨·날짜) ───────────────────────────
# 처음엔 브라우저 localStorage였는데 관리자가 적어도 다른 사람 화면엔 안 보였음 → 서버 파일 하나에(2026-10-14).
# 읽기는 로그인한 누구나, 쓰기는 관리자만
_PERF_UPDATE_PATH = Path(__file__).parent / "data" / "perf_update.json"
_PERF_UPDATE_DEFAULTS = {"label": "경영실적 현황 업데이트", "note": ""}
_PERF_UPDATE_MAXLEN = 60
_perf_update_lock = threading.Lock()


def _read_perf_update() -> dict:
    import json
    out = dict(_PERF_UPDATE_DEFAULTS)
    try:
        saved = json.loads(_PERF_UPDATE_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return out
    except Exception:
        logger.warning("실적 업데이트 표시 파일을 못 읽음 — 기본값 사용: %s", _PERF_UPDATE_PATH)
        return out
    for k in out:
        if isinstance(saved.get(k), str):
            out[k] = saved[k][:_PERF_UPDATE_MAXLEN]
    return out


@app.route("/api/settings/perf-update")
def api_get_perf_update():
    with _perf_update_lock:
        return jsonify(_read_perf_update())


@app.route("/api/settings/perf-update", methods=["PUT"])
def api_put_perf_update():
    if not _extract_key_valid(request):
        return jsonify({"ok": False, "error": "권한이 없습니다"}), 403
    import json
    body = request.get_json(silent=True) or {}
    with _perf_update_lock:
        cur = _read_perf_update()
        for k, v in body.items():
            if k not in _PERF_UPDATE_DEFAULTS or not isinstance(v, str):
                return jsonify({"ok": False, "error": f"잘못된 값: {k}"}), 400
            cur[k] = v.strip()[:_PERF_UPDATE_MAXLEN]
        # 라벨을 다 지우면 기본 문구로
        if not cur["label"]:
            cur["label"] = _PERF_UPDATE_DEFAULTS["label"]
        _PERF_UPDATE_PATH.parent.mkdir(exist_ok=True)
        tmp = _PERF_UPDATE_PATH.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(cur, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, _PERF_UPDATE_PATH)
    logger.info("[실적 업데이트 표시] 변경 %s", cur)
    return jsonify(cur)


# ── 파트별 인원(관리자 수기 입력) — 실적 탭 인당 매출·손익·관리비 차트의 분모(2026-10-23) ──────
# 읽기는 로그인한 누구나(공개 목록 PUBLIC_API에 없음), 쓰기는 관리자만. 저장·검증·계산은 headcount.py
@app.route("/api/settings/headcount")
def api_get_headcount():
    return jsonify(headcount.read_headcount())


@app.route("/api/settings/headcount", methods=["PUT"])
def api_put_headcount():
    admin = current_admin(request)
    if not admin:
        return jsonify({"ok": False, "error": "권한이 없습니다"}), 403
    body = request.get_json(silent=True) or {}
    parts, err = headcount.validate_parts(body.get("parts"))
    if err:
        return jsonify({"ok": False, "error": err}), 400
    # 계획 인원은 안 보내면(옛 화면) 저장돼 있던 값 유지
    if "plan_parts" in body:
        plan_parts, err = headcount.validate_parts(body.get("plan_parts"))
        if err:
            return jsonify({"ok": False, "error": err}), 400
    else:
        plan_parts = headcount.read_headcount()["plan_parts"]
    # 2027 인원(parts27)도 같은 방식 — 안 보내면(옛 화면) 저장돼 있던 값 유지(2026-10-29, 2026·2027 인원을 따로 입력)
    parts27 = None
    if "parts27" in body:
        parts27, err = headcount.validate_parts(body.get("parts27"))
        if err:
            return jsonify({"ok": False, "error": err}), 400
    return jsonify(headcount.write_headcount(parts, plan_parts, admin["emp_no"], parts27))


@app.route("/api/extract/open-file", methods=["POST"])
def api_extract_open_file():
    """추출 현황 목록의 원본 PPT 열기(↗). 미처리·실패 파일은 처리이력에 경로가 없어 재무/KPI 열기 API로는
    못 찾음 → 추출 현황이 폴더를 훑으며 찾은 경로로 연다. 목록에 있는 파일만(임의 경로 X), 관리자 키 필요"""
    if not _extract_key_valid(request):
        return jsonify({"ok": False, "message": "권한이 없습니다"}), 403
    import extract_coverage
    from shared import open_source_file, current_opener
    data = request.get_json(silent=True) or {}
    filename = str(data.get("filename", "")).strip()
    if not filename:
        return jsonify({"ok": False, "message": "파일명이 없습니다."}), 400
    path = extract_coverage.find_path(filename)
    logger.info("[파일 열기/추출 현황] filename=%s -> path=%s", filename, path)
    body, status = open_source_file(path, check_only=bool(data.get("check")), folder=bool(data.get("folder")),
                                        opener=current_opener(request))
    return jsonify(body), status


if __name__ == "__main__":
    with _cache_lock:
        load_excel()
    # API가 귀 기울일 주소(.env API_HOST) — 기본은 이 PC 안(127.0.0.1)만. 화면은 Vite(5188)가 같은 PC에서 /api를 5000으로 중계하므로
    # 밖에서 5000에 직접 닿을 필요 없음. IP 하나만 쓸 수 있고(10.206.0.0/16 같은 대역 표기는 불가) 접속 대역 제한은 Windows 방화벽에서(2026-10-30)
    API_HOST = os.environ.get("API_HOST", "127.0.0.1").strip() or "127.0.0.1"
    try:
        ipaddress.ip_address(API_HOST)
    except ValueError:
        raise SystemExit(f"API_HOST={API_HOST!r}는 IP 주소가 아닙니다 — 127.0.0.1(이 PC만) 또는 0.0.0.0(모든 곳) 같은 IP 하나만 쓸 수 있습니다")
    # 추출 알림 — 매일 아침 8시에 추출 현황을 세어 저장(놓쳤으면 지금 한 번). import 때가 아니라 여기서만 시작(extract_alerts.py)
    import extract_alerts
    extract_alerts.start_scheduler()
    try:
        from waitress import serve
        print(f"서버 시작: http://{API_HOST}:5000")
        serve(app, host=API_HOST, port=5000, threads=4)
    except ImportError:
        app.run(host=API_HOST, port=5000, debug=False)
