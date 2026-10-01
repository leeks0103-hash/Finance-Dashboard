"""
추출 현황(커버리지) — NAS 원본 폴더의 PPT 파일 목록과 추출 결과 엑셀(처리이력·취합)을 대조해
"폴더에 229개 있는데 몇 개가 잘 들어갔고, 안 들어간 건 무엇이며 왜인지"를 파일 단위로 보여준다.
관리자용 기능 모달에서 확인용 + 디버깅용(2026-10-01 요청).

⚠️ NAS는 읽기만 — 폴더 목록(os.walk / iterdir)과 파일 이름만 본다. 파일을 열지 않음.

숫자를 헷갈리지 않게:
  · "폴더 파일 수"  = 추출 스크립트가 대상으로 삼는 PPT 파일 수(스크립트와 같은 규칙으로 셈)
  · "취합 행 수"    = 결과 엑셀의 행 수 — 한 파일에서 여러 행(보고단계별)이 나오고, 같은 키를 쓰는 파일끼리는
                     덮어써서 줄기도 하므로 파일 수와 다른 게 정상. 두 숫자를 섞어 "260개"처럼 오판하지 말 것
"""
from __future__ import annotations

import logging
import os
import re
import threading
import time
from datetime import datetime
from pathlib import Path

import paths
from shared import is_drm_file, read_sheet_cached

logger = logging.getLogger(__name__)

PPT_EXTS = {".ppt", ".pptx"}
# 처리이력 메시지 중 "표가 없었다"는 뜻 — 재무: "…표 데이터 없음" / KPI: "…찾지 못했습니다"
_NO_TABLE_RE = re.compile(r"데이터 없음|찾지 못했")

# 스크립트별 규칙 — 바뀌면 같이 맞출 것
#   재무: scripts/extract_financial_ppt.py find_target_ppt_files — os.walk 전체 깊이, EXCLUDE_FILENAMES 제외
#   KPI : scripts/extract_kpi_ppt.py list_candidate_ppt_files_with_depth_limit — 깊이 2까지(MAX_SEARCH_DEPTH)
FINANCE_EXCLUDE = {"테스트 입니다.pptx"}
KPI_MAX_DEPTH = 2

SOURCES = {
    "finance": {
        "label": "재무",
        "excel": paths.FINANCE_EXCEL_PATH,
        "history_sheet": "처리이력",
        "data_sheet": "취합",
        "file_col": "원본파일명",
        "ok_status": {"SUCCESS"},
        "fail_status": {"FAIL"},
    },
    "kpi": {
        "label": "KPI",
        "excel": paths.KPI_EXCEL_PATH,
        "history_sheet": "처리 이력",
        "data_sheet": "취합",
        "file_col": "파일명",
        "ok_status": {"처리완료"},
        "fail_status": {"실패"},
    },
}

_CACHE_TTL = 30  # 초 — 모달을 열 때마다 NAS 폴더를 다시 훑지 않게
_cache_lock = threading.Lock()
_cache: dict = {"at": 0.0, "data": None}
# 마지막으로 훑은 폴더의 파일명 → 전체경로(바로가기 ↗용). 미처리·실패 파일은 처리이력에 경로가 없어서 여기서 찾음
_file_paths: dict[str, str] = {}


def _list_finance_files(root: str) -> list[str]:
    out = []
    for dirpath, _, files in os.walk(root):
        for name in files:
            if name.startswith("~$") or os.path.splitext(name)[1].lower() not in PPT_EXTS:
                continue
            if name.strip().lower() in {f.lower() for f in FINANCE_EXCLUDE}:
                continue
            out.append(os.path.join(dirpath, name))
    return out


def _list_kpi_files(root: str) -> list[str]:
    out: list[str] = []
    excel_name = Path(paths.KPI_EXCEL_PATH).name

    def walk(p: Path, depth: int):
        if depth > KPI_MAX_DEPTH:
            return
        try:
            for item in p.iterdir():
                if item.is_file():
                    if item.name.startswith("~$") or item.suffix.lower() not in PPT_EXTS or item.name == excel_name:
                        continue
                    out.append(str(item))
                elif item.is_dir():
                    walk(item, depth + 1)
        except OSError as e:
            logger.warning("추출 현황 — 폴더 읽기 실패: %s (%s)", p, e)

    walk(Path(root), 0)
    return out


def _explain_failure(path: str) -> str:
    """실패 메시지(대개 PowerPoint COM 오류 코드 — com_error(-2147352567, …))는 봐도 알 수 없어서,
    파일 맨 앞 몇 바이트로 종류를 짚어 쉬운 말 한 줄로. 원본 오류는 화면에 안 보이고 항목의 detail(마우스 올리면)로만.
    읽기만 함(8바이트) — NAS 파일을 열어 PowerPoint로 띄우는 게 아님"""
    try:
        with open(path, "rb") as f:
            head = f.read(8)
    except OSError:
        return "원본 폴더에서 파일을 찾지 못함 — 옮겨졌거나 이름이 바뀐 듯"
    if head.startswith(b"SCDSA"):
        # 프론트 isDrmItem이 'DRM' 글자로 판단 — 문구를 바꾸면 같이 볼 것
        return "보안 문서(DRM)라 열 수 없음 — 이 PC에서 직접 열지 말고 원본 담당자에게 확인"
    if head.startswith(bytes.fromhex("d0cf11e0")):
        return "암호화(AIP)됐거나 옛 형식(.ppt)이라 열지 못함"
    return "PowerPoint로 열다가 실패 — 일시 오류일 수 있으니 다시 추출해 보세요"


def _source_coverage(key: str, folder_files: list[str]) -> dict:
    cfg = SOURCES[key]
    result = {
        "label": cfg["label"], "excel_ok": True, "folder_files": len(folder_files),
        "counts": {"extracted": 0, "merged": 0, "no_table": 0, "failed": 0, "pending": 0}, "rows_total": 0,
        "duplicate_names": 0, "orphans": [], "items": [],
    }
    hist = read_sheet_cached(cfg["excel"], cfg["history_sheet"]) if os.path.exists(cfg["excel"]) else None
    data = read_sheet_cached(cfg["excel"], cfg["data_sheet"]) if os.path.exists(cfg["excel"]) else None
    if hist is None or data is None:
        result["excel_ok"] = False

    # 처리이력 — 파일명별 가장 최근 1건(같은 파일이 여러 번 재처리되면 처리일시 최대)
    latest: dict[str, dict] = {}
    if hist is not None and {"파일명", "처리상태"} <= set(hist.columns):
        h = hist.copy()
        h["처리일시"] = h.get("처리일시", "").astype(str)
        for _, r in h.sort_values("처리일시").iterrows():
            name = str(r["파일명"]).strip()
            if name:
                latest[name] = {"status": str(r["처리상태"]).strip(), "message": str(r.get("메시지", "") or "").strip(),
                                "at": str(r["처리일시"]).strip(), "path": str(r.get("전체경로", "") or "").strip()}

    rows_by_file: dict[str, int] = {}
    if data is not None and cfg["file_col"] in data.columns:
        names = data[cfg["file_col"]].astype(str).str.strip()
        names = names[(names != "") & (names.str.lower() != "nan")]
        rows_by_file = names.value_counts().to_dict()
        result["rows_total"] = int(len(names))

    # 같은 파일명이 하위 폴더 두 곳에 있으면 결과 엑셀에선 구분이 안 됨 — 숫자가 안 맞는 원인이라 따로 셈
    seen: dict[str, int] = {}
    for n in folder_files:
        seen[n] = seen.get(n, 0) + 1
    result["duplicate_names"] = sum(c - 1 for c in seen.values() if c > 1)

    for name in sorted(seen):
        h = latest.get(name)
        rows = int(rows_by_file.get(name, 0))
        if h is None:
            status, reason = "pending", "아직 처리 안 됨(처리이력에 없음) — 다음 추출 때 처리됨"
        elif h["status"] in cfg["fail_status"]:
            status, reason = "failed", _explain_failure(h["path"])
        elif rows > 0:
            status, reason = "extracted", ""
        elif _NO_TABLE_RE.search(h["message"]):
            # 열어 봤지만 재무/KPI 표가 없는 PPT(양식 밖 보고서·자체 기획 등)
            status, reason = "no_table", h["message"]
        else:
            # 행은 뽑았는데 취합엔 이 파일 이름의 행이 없음 — 같은 (코드/연도/단계) 키를 쓰는 다른 파일(보통 같은 프로젝트의
            # 다음 단계 보고서)이 나중에 같은 행을 덮어써서 그 파일 이름으로 남은 것. 데이터가 사라진 건 아님
            status = "merged"
            reason = f"{h['message']} → 같은 (코드/연도/단계) 행을 다른 파일이 덮어써 그 파일 이름으로 남음(보통 같은 프로젝트의 다른 단계 보고서)"
        result["counts"][status] += 1
        result["items"].append({"file": name, "status": status, "rows": rows, "reason": reason,
                                # 원본 처리 메시지(오류 코드 등) — 실패일 때만, 화면엔 마우스 올렸을 때만
                                "detail": h["message"] if status == "failed" else "",
                                "at": h["at"] if h else ""})

    # 결과 엑셀엔 있는데 폴더엔 없는 파일 — 다음 추출 때 정리되지만, 그 전까진 숫자가 안 맞는 원인
    result["orphans"] = sorted(n for n in rows_by_file if n not in seen)
    return result


def coverage(force: bool = False) -> dict:
    with _cache_lock:
        if not force and _cache["data"] is not None and time.time() - _cache["at"] < _CACHE_TTL:
            return _cache["data"]
    root = paths.PPT_SOURCE_DIR
    if not os.path.isdir(root):
        return {"ok": False, "error": f"원본 폴더에 접근할 수 없습니다: {root}"}
    t0 = time.time()
    finance_paths = _list_finance_files(root)
    kpi_paths = _list_kpi_files(root)
    finance_files = [os.path.basename(p) for p in finance_paths]
    kpi_files = [os.path.basename(p) for p in kpi_paths]
    data = {
        "ok": True,
        "folder": root,
        "scanned_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "finance": _source_coverage("finance", finance_files),
        "kpi": _source_coverage("kpi", kpi_files),
    }
    logger.info("추출 현황 계산 %.1f초 (재무 %d개 · KPI %d개)", time.time() - t0, len(finance_files), len(kpi_files))
    with _cache_lock:
        _cache.update(at=time.time(), data=data)
        _file_paths.clear()
        _file_paths.update({os.path.basename(p): p for p in finance_paths + kpi_paths})
    return data


def find_path(filename: str) -> str | None:
    """추출 현황 목록의 파일명 → 원본 전체경로. 아직 안 훑었으면 한 번 훑음"""
    with _cache_lock:
        scanned = bool(_file_paths)
    if not scanned:
        coverage()
    with _cache_lock:
        return _file_paths.get(filename)


def failed_paths(key: str) -> tuple[list[str], list[str]]:
    """'실패 파일만 다시 추출'용 — (다시 추출할 전체경로, DRM이라 뺀 파일명).
    상태 판정은 추출 현황과 같은 기준(처리이력 최신 1건이 실패). 매번 새로 셈(30초 캐시 무시)
    DRM(SCDSA) 파일은 제외 — 이 PC의 PowerPoint로 여는 순간 NAS 원본이 재암호화됐던 전례(2026-09-23)"""
    data = coverage(force=True)
    if not data.get("ok") or key not in data:
        return [], []
    with _cache_lock:
        lookup = dict(_file_paths)
    targets, skipped = [], []
    for it in data[key]["items"]:
        if it["status"] != "failed":
            continue
        path = lookup.get(it["file"])
        if not path:
            continue
        if is_drm_file(path):
            skipped.append(it["file"])
        else:
            targets.append(path)
    return targets, skipped
