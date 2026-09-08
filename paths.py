"""데이터 파일 경로 **단일 관리** 모듈.

Flask 앱(app/finance/kpi/performance)과 scripts/ 추출 스크립트가 전부 여기만 본다.
파일명이 바뀌면 `.env` 만 고치면 되고, `.env` 가 없거나 가리키는 파일이 없으면
`data/` 안에서 자동으로 찾는다 — 코드는 손댈 필요 없음.

.env 변수명
-----------
    EXCEL_PATH            재무 추출 결과 엑셀
    KPI_EXCEL_PATH        KPI 추출 결과 엑셀
    PERF_EXCEL_PATH       실적(사업계획 통합관리) 엑셀 — 매달 새 ver 파일로 교체됨
    EXTRACT_BASE_DIR      재무 추출 스크립트가 스캔할 PPT 원본 폴더
    EXTRACT_KPI_ROOT_DIR  KPI 추출 스크립트가 스캔할 PPT 원본 폴더
"""

import glob
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


def resolve_perf_excel() -> str:
    """실적 엑셀 경로 — .env 우선, 없거나 파일이 없으면 data/ 안 최신 수정본 자동 선택.

    매달 새 ver 파일을 data/ 에 넣기만 하면 .env·코드 어느 쪽도 안 고쳐도 된다.
    (Excel 임시 잠금파일 `~$...` 는 제외)
    """
    val = os.environ.get("PERF_EXCEL_PATH", "").strip()
    if val:
        path = val if os.path.isabs(val) else os.path.join(BASE_DIR, val)
        if os.path.exists(path):
            return path
        logger.warning("PERF_EXCEL_PATH 파일 없음(%s) — data/ 최신 파일로 자동 폴백", val)

    candidates = [
        f
        for ext in ("xlsx", "xlsb")
        for f in glob.glob(os.path.join(DATA_DIR, f"*사업계획 통합관리 파일*.{ext}"))
        if not os.path.basename(f).startswith("~$")
    ]
    if not candidates:
        return os.path.join(BASE_DIR, val) if val else os.path.join(DATA_DIR, "사업계획 통합관리 파일.xlsx")
    latest = max(candidates, key=os.path.getmtime)
    logger.info("실적 엑셀 자동 선택: %s", os.path.basename(latest))
    return latest


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
_DEFAULT_PPT_DIR = r"C:\Users\aaa\Desktop\5. 보고서 수집"
EXTRACT_BASE_DIR     = os.environ.get("EXTRACT_BASE_DIR", _DEFAULT_PPT_DIR)
EXTRACT_KPI_ROOT_DIR = os.environ.get("EXTRACT_KPI_ROOT_DIR", _DEFAULT_PPT_DIR)
