"""데이터 파일 경로 **단일 관리** 모듈.

Flask 앱(app/finance/kpi/performance)과 scripts/ 추출 스크립트가 전부 여기만 본다.
파일명이 바뀌면 `.env` 만 고치면 되고, `.env` 가 없거나 가리키는 파일이 없으면
`data/` 안에서 자동으로 찾는다 — 코드는 손댈 필요 없음.

.env 변수명
-----------
    EXCEL_PATH            재무 추출 결과 엑셀
    KPI_EXCEL_PATH        KPI 추출 결과 엑셀
    PERF_EXCEL_PATH       실적(사업계획 통합관리) 엑셀 — 매달 새 ver 파일로 교체됨

PPT 원본 폴더(추출 스크립트 입력)는 .env를 따르지 않고 NAS 경로로 고정 — 아래 PPT_SOURCE_DIR
"""

import glob
import re
import logging
import os

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

# 추출 스크립트가 만들어내는 고정 파일명 (스크립트 출력 = Flask 입력, 여기 한 곳에서만 정의)
FINANCE_EXCEL_NAME = "재무관점 필수 데이터 추출.xlsx"
KPI_EXCEL_NAME     = "KPI 지표 데이터 추출.xlsx"


def _from_env(var: str, default_name: str) -> str:
    """환경변수 경로(상대경로면 프로젝트 루트 기준) → 없으면 data/기본파일명."""
    val = os.environ.get(var, "").strip()
    if val:
        return val if os.path.isabs(val) else os.path.join(BASE_DIR, val)
    return os.path.join(DATA_DIR, default_name)


# "…ver9.4_261013_9월…" → 261013(yymmdd). 날짜가 이름 끝에 오는 "…취합 완료_261028.xlsx"도 인식(2026-10-29 —
# 예전엔 `_` 뒤가 필수라 이런 이름이 수정 시각 폴백으로 밀려 날짜 있는 옛 파일보다 뒤로 갔음)
_PERF_NAME_DATE_RE = re.compile(r"_(\d{6})(?=[_.]|$)")


def perf_excel_candidates() -> list[str]:
    """data/ 바로 아래의 실적 엑셀(이름에 '사업계획 통합관리 파일') — 최신 먼저.
    최신 = 파일명의 날짜(_yymmdd_) → 없으면 수정 시각. 복사해 넣으면 수정 시각이 원본 그대로라 날짜를 먼저 봄.
    하위 폴더(경영실적 히스토리 등)와 Excel 잠금파일(~$)은 제외."""
    files = [
        f
        for ext in ("xlsx", "xlsb")
        for f in glob.glob(os.path.join(DATA_DIR, f"*사업계획 통합관리 파일*.{ext}"))
        if not os.path.basename(f).startswith("~$")
    ]

    def key(f):
        m = _PERF_NAME_DATE_RE.search(os.path.basename(f))
        return (m.group(1) if m else "000000", os.path.getmtime(f))
    return sorted(files, key=key, reverse=True)


# True = data/ 최신 파일 우선(.env는 후보 없을 때만 — 실적 자동 반영용, 2026-10-14) / False = 예전처럼 .env 우선.
# 자동 반영(performance.PERF_AUTO_UPDATE)을 꺼 둔 동안은 False
PERF_PICK_NEWEST = True   # 2026-10-15 켬(자동 반영과 같이)


def resolve_perf_excel() -> str:
    """실적 엑셀 경로.
    PERF_PICK_NEWEST=False(지금): .env PERF_EXCEL_PATH 우선, 없거나 파일이 없으면 data/ 최신(perf_excel_candidates 첫 번째).
    True: data/ 최신 우선 — 예전엔 .env가 우선이라 새 파일을 넣어도 고정된 옛 파일을 계속 읽었음."""
    val = os.environ.get("PERF_EXCEL_PATH", "").strip()
    env_path = (val if os.path.isabs(val) else os.path.join(BASE_DIR, val)) if val else ""
    cands = perf_excel_candidates()
    if not PERF_PICK_NEWEST and env_path:
        if os.path.exists(env_path):
            return env_path
        logger.warning("PERF_EXCEL_PATH 파일 없음(%s) — data/ 최신 파일로 자동 폴백", val)
    if cands:
        return cands[0]
    return env_path or os.path.join(DATA_DIR, "사업계획 통합관리 파일.xlsx")


# ── 엑셀 경로 ────────────────────────────────────────────────
FINANCE_EXCEL_PATH = _from_env("EXCEL_PATH", FINANCE_EXCEL_NAME)
KPI_EXCEL_PATH     = _from_env("KPI_EXCEL_PATH", KPI_EXCEL_NAME)
PERF_EXCEL_PATH    = resolve_perf_excel()

# ── 추출 스크립트 부산물 (로그·실패목록) ─────────────────────
FINANCE_LOG_FILE     = os.path.join(DATA_DIR, "extract_financial_ppt.log")
FINANCE_AIP_FAILED   = os.path.join(DATA_DIR, "aip_failed.txt")
KPI_AIP_FAILED       = os.path.join(DATA_DIR, "kpi_aip_failed.txt")
QUALITY_REPORT_XLSX  = os.path.join(DATA_DIR, "quality_report.xlsx")
COMPARE_REPORT_XLSX  = os.path.join(DATA_DIR, "compare_report.xlsx")

# ── PPT 원본 폴더 (추출 스크립트 입력) ───────────────────────
# .env(EXTRACT_BASE_DIR/EXTRACT_KPI_ROOT_DIR)·CLI 인수와 무관하게 NAS 보고서 수집 폴더로 강제 고정(2026-09-30 요청).
# ⚠️ NAS는 읽기 전용 — 스캔만 하고 출력은 항상 로컬 data/
PPT_SOURCE_DIR       = r"\\10.206.32.3\기술교육팀\1. 실 공통\5. 보고서 수집"
EXTRACT_BASE_DIR     = PPT_SOURCE_DIR
EXTRACT_KPI_ROOT_DIR = PPT_SOURCE_DIR
