import logging
import os
import re
import threading
from datetime import datetime

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from flask import Blueprint, jsonify, request
from markupsafe import escape as html_escape

import headcount
from shared import is_ranked_valid_code, safe_mtime, sort_frame, strip_part_prefix, PART_PREFIX_RE
from auth import admin_required

load_dotenv()

logger = logging.getLogger(__name__)

perf_bp = Blueprint("performance", __name__)

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DATA_DIR  = os.path.join(_BASE_DIR, "data")

# 실적 엑셀 경로는 paths.py 한 곳에서 관리 (.env: PERF_EXCEL_PATH, 없으면 data/ 최신 자동)
from paths import resolve_perf_excel

PERF_EXCEL_PATH = resolve_perf_excel()

# 실적 파일 자동 반영(perf_autoupdate — 열 자동 맞추기·H-chat·계산식 검증·직전 파일 폴백, 2026-10-14) — 일단 꺼 둠(같은 날 요청).
# False면 예전과 똑같이: paths.resolve_perf_excel() 파일 하나(.env PERF_EXCEL_PATH 우선)를 코드 맵(_PERF_COL_MAPS)으로 읽음.
# 켜려면 True + paths.PERF_PICK_NEWEST True + AdminModal의 <PerfUpdatePanel /> 주석 해제
PERF_AUTO_UPDATE = True   # 2026-10-15 켬

# 업로드로 자동 맞춘 열 매핑 저장 위치(2026-10-14) — data/는 gitignore
PERF_LEARNED_MAPS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "perf_col_maps.json")
_PERF_SHEET_RE = re.compile(r"^(\d{4})년 \((\d+)월 (추정|집계)\)$")

# ── 2027 사업계획 시트(2026-10-29) ─────────────────────────────────────────
# 뷰 두 가지: "actual"(N월 집계/추정 시트 — 실적, 기준월·누계 있음) / "plan27"(사업계획 시트 — 기준월·실적 없음, 월별 값은 계획 분배).
# 계획 시트 이름은 느슨하게 봄: "연도 + '계획'"이 든 시트("2027년 (사업계획)", "2028년 사업계획" …)이면서 N월 실적 시트가 아닌 것.
# "(사업계획 참조)"처럼 연도 없는 보조 시트·"기타. 사업계획 재정리(260818)"는 걸리지 않음. 최종 판정은 계산식 검증(perf_autoupdate.validate)
_PLAN_SHEET_RE = re.compile(r"^\s*(\d{4})\s*년.*계획")
PERF_VIEWS = ("actual", "plan27")

_perf_cached_df: pd.DataFrame = pd.DataFrame()
_perf_last_loaded = None
_perf_cached_mtime = None
_perf_current_month = 0   # 자동 선택된 시트의 기준월 (전월대비 계산에 사용)
_perf_current_year = 0    # 자동 선택된 시트의 연도 — 화면의 "1~N월" 표기 기준(summary base로 내려줌)
_perf_cache_lock = threading.Lock()

# 계획 뷰("plan27") 캐시 — 실적 뷰 전역(위)은 그대로 두고 따로 둠(ai_insight 등이 실적 전역을 직접 읽음).
# seen = 마지막으로 시도한 (최신 파일 경로, 수정 시각) — 최신 파일에 계획 시트가 없거나 실패했을 때 5초마다 다시 읽지 않게
_plan_cache = {"df": pd.DataFrame(), "path": None, "mtime": None, "year": 0, "sheet": None, "loaded": None, "seen": None}
_plan_cache_lock = threading.Lock()

# ──────────────────────────────────────────────────────────────
# 컬럼맵
# ──────────────────────────────────────────────────────────────
# ⚠️ 매달 새 시트가 추가될 때마다 컬럼 배치가 통째로 바뀔 수 있음(고정 스키마 아님).
#    새 달 추가 시 scripts/check_perf_headers.py로 헤더를 먼저 확인하고
#    아래 _PERF_COL_MAPS에 새 항목만 추가할 것 (지난달 맵 덮어쓰기 금지).
_PERF_COL_MAP_JUN = {
    1:  "tech_category",
    2:  "team",
    3:  "part",
    4:  "use_yn",
    5:  "biz_division",
    6:  "biz_type",
    7:  "customer_type",
    8:  "biz_plan",
    9:  "progress",
    10: "category",
    11: "edu_type",
    12: "budget_code",
    13: "project_code",
    14: "biz_type2",
    15: "budget_unit",
    16: "project_name",
    18: "manager",
    19: "actual_2025",
    20: "plan_initial",
    21: "plan_cost_rate",
    22: "course_count",
    23: "session_count",
    24: "participant_count",
    36: "jun_est",
    37: "jun_est_rate",
    38: "jun_actual",
    39: "jun_cost_rate",
    40: "cost_rate_diff",
    41: "est_vs_actual",
    42: "cost_rate_reason",
    43: "plan_diff_amount",
    44: "plan_diff_rate",
    45: "plan_diff_reason",
    46: "profit_gross",
    47: "cost_direct",
    48: "cost_labor",
    49: "cost_overhead",
    50: "cost_mgmt",
    51: "operating_profit",
    52: "profit_rate_raw",
    53: "jun_check_total",
    54: "chk_m01",
    55: "chk_m02",
    56: "chk_m03",
    57: "chk_m04",
    58: "chk_m05",
    59: "chk_m06",
    60: "chk_m07",
    61: "chk_m08",
    62: "chk_m09",
    63: "chk_m10",
    64: "chk_m11",
    65: "chk_m12",
    66: "chk_cost_rate",
    67: "chk_course",
    68: "chk_session",
    69: "chk_participant",
    70: "change_note",
    73: "balance_amount",
    74: "balance_rate",
    76: "dup_check",
    77: "ref_code",
    80: "sa_direct_total",
    81: "sa_instructor",
    82: "sa_sub_instructor",
    83: "sa_venue",
    84: "sa_practice",
    85: "sa_textbook",
    86: "sa_other_direct",
    87: "sa_overhead_total",
    88: "sa_refreshment",
    89: "sa_edu_venue",
    90: "sa_parking",
    91: "sa_sw_practice",
    92: "sa_intern",
    93: "sa_labor_total",
    94: "sa_regular",
    95: "sa_overhead_cost",
    97: "note",
}

# 7월 시트: 40번 앞에 2컬럼, 41번 앞에 1컬럼 추가 삽입 → 40번부터 +2, 41번부터 +3
# ⚠️ 38/39번(jun_actual/jun_cost_rate)은 이 시프트 공식으로는 그대로 38/39에 남는데,
#    실제로는 "6월 결산" 컬럼(AM/AN열)이라 최신월이 아님 — 새로 삽입된 40/41번(AO/AP열)이
#    "7월 결산 기준 실적 집계 현황"(진짜 최신 실적). jun_actual/jun_cost_rate는
#    "이번 집계월 실적"을 가리키는 논리 필드이므로 시트가 바뀔 때마다 최신월 컬럼으로 재매핑 필요.
#    (2026-08-25 실적현황 계산.png 대조 검증 — AM열이 아니라 AO열이 맞음)
_PERF_COL_MAP_JUL = {
    (idx + 3 if idx >= 41 else idx + 2 if idx == 40 else idx): name
    for idx, name in _PERF_COL_MAP_JUN.items()
    if idx not in (38, 39)
}
_PERF_COL_MAP_JUL[40] = "jun_actual"
_PERF_COL_MAP_JUL[41] = "jun_cost_rate"

# 8월 시트(ver8.3_260901): L열 "비딩여부"가 신규 삽입돼 K 이후가 통째로 +1 밀림 →
# 시프트 공식으로 유도하지 말고 실제 헤더를 그대로 옮겨 적는다.
# (scripts/check_perf_headers.py 또는 헤더 덤프로 검증 — 2026-09-07)
_PERF_COL_MAP_AUG = {
    1:  "tech_category",      # B 미래기술 분류
    2:  "team",               # C 팀
    3:  "part",               # D 파트
    4:  "use_yn",             # E 2026년 사용여부
    5:  "biz_division",       # F 사업 분류
    6:  "biz_type",           # G 사업구분
    7:  "customer_type",      # H 고객구분
    8:  "biz_plan",           # I 사업계획
    9:  "progress",           # J 진행
    10: "category",           # K 구분(매출/원가)
    # 11(L) "비딩여부" — 8월 시트 신규 컬럼, 대시보드 미사용
    12: "edu_type",           # M 교육형태
    13: "budget_code",        # N 예산코드
    14: "project_code",       # O 프로젝트코드
    15: "biz_type2",          # P 사업유형
    16: "budget_unit",        # Q 예산단위
    17: "project_name",       # R 26년 프로젝트명
    19: "manager",            # T 담당자
    20: "actual_2025",        # U 2025년
    21: "plan_initial",       # V 최초사업계획
    22: "plan_cost_rate",     # W (원가율)
    23: "course_count",       # X 과정
    24: "session_count",      # Y 차수
    25: "participant_count",  # Z 인원
    41: "jun_est",            # AP 7월 기준 실적 집계 현황
    42: "jun_est_rate",       # AQ (원가율)
    43: "jun_actual",         # AR 8월 결산 기준 실적 집계 현황 ← 최신월
    44: "jun_cost_rate",      # AS (원가율)
    45: "cost_rate_diff",     # AT 원가율 차이 (전월비)
    47: "est_vs_actual",      # AV 당월 추정 대비 실적
    48: "cost_rate_reason",   # AW 원가율 차이 사유
    49: "plan_diff_amount",   # AX 차이금액 (최초 계획 vs 연간 추정)
    50: "plan_diff_rate",     # AY 증감율
    51: "plan_diff_reason",   # AZ 사유
    52: "profit_gross",       # BA 매출이익
    53: "cost_direct",        # BB 직접원가
    54: "cost_labor",         # BC 인건비
    55: "cost_overhead",      # BD 공통원가
    56: "cost_mgmt",          # BE 관리비
    57: "operating_profit",   # BF 경상손익
    58: "profit_rate_raw",    # BG 손익률
    59: "jun_check_total",    # BH 8월 점검 / 합계
    60: "chk_m01", 61: "chk_m02", 62: "chk_m03", 63: "chk_m04",   # BI~BL
    64: "chk_m05", 65: "chk_m06", 66: "chk_m07", 67: "chk_m08",   # BM~BP
    68: "chk_m09", 69: "chk_m10", 70: "chk_m11", 71: "chk_m12",   # BQ~BT
    72: "chk_cost_rate",      # BU (원가율)
    73: "chk_course",         # BV 과정
    74: "chk_session",        # BW 차수
    75: "chk_participant",    # BX 인원
    76: "change_note",        # BY 변동 검토의견
    79: "balance_amount",     # CB 대차금액
    80: "balance_rate",       # CC 대차비율
    82: "dup_check",          # CE 중복 코드 점검
    83: "ref_code",           # CF 참조 코드
    86: "sa_direct_total",    # CI 직접원가 소계
    87: "sa_instructor",      # CJ 강사비
    88: "sa_sub_instructor",  # CK 보조강사비
    89: "sa_venue",           # CL 강의장
    90: "sa_practice",        # CM 실습비
    91: "sa_textbook",        # CN 교재비
    92: "sa_other_direct",    # CO 기타
    93: "sa_overhead_total",  # CP 공통원가 소계
    94: "sa_refreshment",     # CQ 다과비
    95: "sa_edu_venue",       # CR 교육장
    96: "sa_parking",         # CS 주차비
    97: "sa_sw_practice",     # CT 실습비(SW·교보재)
    98: "sa_intern",          # CU 인턴/파견 인건비
    99: "sa_labor_total",     # CV 인건비 소계
    100: "sa_regular",        # CW 정규직
    101: "sa_overhead_cost",  # CX 제경비
    103: "note",              # CZ 비고
}

_PERF_COL_MAP_SEP = {(i if i < 17 else i + 1): name for i, name in _PERF_COL_MAP_AUG.items()}

# 2027년 (사업계획) 시트(27년 사업계획 통합관리 파일 ver3.1_261028) — 2026-10-29. 머리글 11~12행·데이터 13행~, 매출행+원가행 2행 구조는 실적 시트와 같고
# 열 배치·의미가 다름. 실적 시트와 **같은 내부 필드 이름을 재사용**해 계산식 검증(perf_autoupdate.validate)·프로젝트 병합(_merge_rev_cost_rows)·표를 그대로 씀:
#   plan_initial    ← Z(25) "2026년 연간 추정"  = 비교 기준(26 추정). 시트가 차이금액·증감율을 이 기준으로 줌(AI = AC − Z)
#   jun_check_total ← AS(44) "2027년 사업계획 합계" = 27 계획(AC(28)와 같은 값. 1~12월 합과 항등식이 맞는 건 AS)
#   chk_m01..12     ← AT~BE(45~56) 1~12월 **계획 분배**(실적 아님 — 기준월·누계 개념 없음, jun_actual·acc_* 는 0)
# ⚠️ 필드 이름은 실적 시트와 같지만 **의미가 다름**(plan_initial = 최초계획이 아니라 26 추정) — 이 시트는 view="plan27" 응답(build_plan_summary)으로만 내보냄.
# 실측 대조(2026-10-29, 사용 행): AS = 1~12월 합 100% · AL = AS − AM 100% · AQ = AL − AN − AO − AP 100% · AM = 아래 원가행 AS 100% · AI = AC − Z 100%
_PERF_COL_MAP_PLAN27 = {
    1:  "tech_category",      # B 미래기술 분류
    2:  "team",               # C 팀
    3:  "part",               # D 파트
    4:  "use_yn",             # E 2026년 사용여부
    5:  "biz_division",       # F 사업 분류
    6:  "biz_type",           # G 사업구분
    7:  "customer_type",      # H 고객구분
    8:  "biz_plan",           # I 사업계획
    9:  "progress",           # J 진행
    10: "category",           # K 구분(매출/원가)
    # 11(L) 비딩여부, 13(N) 전년도 연관성, 14(O) 전년도 프로젝트코드, 20(U) 사업구분 — 대시보드 미사용
    12: "edu_type",           # M 교육형태
    15: "budget_code",        # P 예산코드
    16: "project_code",       # Q 프로젝트코드
    17: "biz_type2",          # R 사업유형
    18: "budget_unit",        # S 예산단위
    19: "project_name",       # T 26년 프로젝트명
    21: "manager",            # V 담당자
    22: "actual_2025",        # W 2025년
    25: "plan_initial",       # Z 2026년 연간 추정 ← 비교 기준
    34: "plan_diff_amount",   # AI 차이금액(27 계획 − 26 추정)
    35: "plan_diff_rate",     # AJ 증감율
    36: "plan_diff_reason",   # AK 사유
    37: "profit_gross",       # AL 매출이익
    38: "cost_direct",        # AM 직접원가
    39: "cost_labor",         # AN 인건비
    40: "cost_overhead",      # AO 공통원가
    41: "cost_mgmt",          # AP 관리비
    42: "operating_profit",   # AQ 경상손익
    43: "profit_rate_raw",    # AR 손익률
    44: "jun_check_total",    # AS 2027년 사업계획 합계 ← 27 계획
    45: "chk_m01", 46: "chk_m02", 47: "chk_m03", 48: "chk_m04",   # AT~AW
    49: "chk_m05", 50: "chk_m06", 51: "chk_m07", 52: "chk_m08",   # AX~BA
    53: "chk_m09", 54: "chk_m10", 55: "chk_m11", 56: "chk_m12",   # BB~BE
    57: "chk_cost_rate",      # BF (원가율)
    58: "chk_course",         # BG 과정
    59: "chk_session",        # BH 차수
    60: "chk_participant",    # BI 인원
    61: "change_note",        # BJ 변동 검토의견
    64: "balance_amount",     # BM 대차금액
    65: "balance_rate",       # BN 대차비율
    67: "dup_check",          # BP 중복 코드 점검
    68: "ref_code",           # BQ 참조 코드
    71: "sa_direct_total",    # BT 직접원가 소계
    72: "sa_instructor",      # BU 강사비
    73: "sa_sub_instructor",  # BV 보조강사비
    74: "sa_venue",           # BW 강의장
    75: "sa_practice",        # BX 실습비
    76: "sa_textbook",        # BY 교재비
    77: "sa_other_direct",    # BZ 기타
    78: "sa_overhead_total",  # CA 공통원가 소계
    79: "sa_refreshment",     # CB 다과비
    80: "sa_edu_venue",       # CC 교육장
    81: "sa_parking",         # CD 주차비
    82: "sa_sw_practice",     # CE 실습비(SW·교보재)
    83: "sa_intern",          # CF 인턴/파견 인건비
    84: "sa_labor_total",     # CG 인건비 소계
    85: "sa_regular",         # CH 정규직
    86: "sa_overhead_cost",   # CI 제경비
    88: "note",               # CK 비고
}

# 실적 시트에는 있고 계획 시트엔 없는 필드(jun_actual 등)도 열(0 또는 빈 값)로 채워 두기 위한 전체 필드 목록 — 계획 뷰에서도 같은 열 이름으로 표·병합 코드가 돎
_ALL_PERF_FIELDS = set(_PERF_COL_MAP_SEP.values()) | set(_PERF_COL_MAP_PLAN27.values())

_PERF_COL_MAPS = {
    "2026년 (6월 집계)": _PERF_COL_MAP_JUN,
    "2026년 (7월 추정)": _PERF_COL_MAP_JUL,
    "2026년 (8월 추정)": _PERF_COL_MAP_AUG,
    # ver8.4_260908: "8월 집계"(확정실적) 시트 신규 추가 — check_perf_headers.py로 대조 시
    # "8월 추정"과 컬럼 구조(104개, 순서) 완전 동일 확인 → 같은 맵 재사용
    "2026년 (8월 집계)": _PERF_COL_MAP_AUG,
    # ver9.4_261013: 9월 시트는 17(R)에 "DK수정 (향후삭제)" 컬럼이 새로 끼어 17 이후 전부 +1 —
    # check_perf_headers.py로 대조(나머지 차이는 "8월→9월" 월 문구뿐), 9월 추정·집계 구조 동일.
    # 원본에서 그 컬럼이 지워지면 다시 _PERF_COL_MAP_AUG로 돌아갈 것
    "2026년 (9월 추정)": _PERF_COL_MAP_SEP,
    "2026년 (9월 집계)": _PERF_COL_MAP_SEP,
    # 27년 파일(ver3.1_261028): 2027 사업계획 시트 — 계획 전용 뷰(view="plan27"), 위 _PERF_COL_MAP_PLAN27 주석 참고
    "2027년 (사업계획)": _PERF_COL_MAP_PLAN27,
}


def _resolve_perf_sheet(sheet_names):
    candidates = {}
    for name in sheet_names:
        m = _PERF_SHEET_RE.match(str(name).strip())
        if not m:
            continue
        year, month, kind = int(m.group(1)), int(m.group(2)), m.group(3)
        candidates.setdefault((year, month), {})[kind] = name
    if not candidates:
        raise ValueError(
            f"실적 엑셀에서 'YYYY년 (N월 추정|집계)' 형식의 시트를 찾을 수 없습니다. "
            f"시트 목록: {list(sheet_names)}"
        )
    latest = candidates[max(candidates.keys())]
    return latest.get("집계") or latest.get("추정")


def is_plan_sheet(name) -> bool:
    """사업계획 시트인가 — 이름에 연도와 '계획'이 있고 N월 실적 시트가 아님(_PLAN_SHEET_RE 주석 참고)"""
    s = str(name).strip()
    return not _PERF_SHEET_RE.match(s) and bool(_PLAN_SHEET_RE.match(s))


def _resolve_plan_sheet(sheet_names) -> "str | None":
    """가장 최근 연도의 사업계획 시트 이름 — 없으면 None(그 파일엔 계획 뷰가 없다는 뜻이지 오류가 아님).
    _resolve_perf_sheet(실적)은 그대로 둠 — 테스트가 고정하고, 계획 시트가 실적 시트로 잘못 뽑히면 안 되므로"""
    best = None
    for name in sheet_names:
        if is_plan_sheet(name):
            year = int(_PLAN_SHEET_RE.match(str(name)).group(1))
            if best is None or year >= best[0]:
                best = (year, name)
    return best[1] if best else None


def _learned_col_maps() -> dict:
    """관리자 업로드로 자동 맞춘 열 매핑(data/perf_col_maps.json) — {시트명: {열 번호: 필드}}. 코드의 _PERF_COL_MAPS 다음으로 봄"""
    import json
    try:
        with open(PERF_LEARNED_MAPS_PATH, encoding="utf-8") as f:
            raw = json.load(f)
        return {sheet: {int(k): v for k, v in m.items()} for sheet, m in raw.items()}
    except FileNotFoundError:
        return {}
    except Exception:
        logger.warning("학습된 열 매핑 파일을 못 읽음 — 무시: %s", PERF_LEARNED_MAPS_PATH, exc_info=True)
        return {}


def perf_col_map(sheet: str) -> "dict | None":
    """시트 → 열 매핑. 코드에 적은 맵(_PERF_COL_MAPS) 우선, 없으면 업로드로 학습한 맵"""
    return _PERF_COL_MAPS.get(sheet) or _learned_col_maps().get(sheet)


def _plan_overhead_from_block(raw: "pd.DataFrame", rev_plan_sum: float, cost_plan_sum: float, col: str = "plan_initial") -> "float | None":
    """사업계획(최초사업계획 열) 기준 공통원가 — 시트 맨 아래 합계 블록(구분 열에 매출 / 원가 / 공통원가 / 인건비 … 순)의
    '공통원가' 줄 값(천원). 프로젝트 행엔 없는 값이라 거기서만 읽는다(2026-10-23, 9월 집계 924행 W열 = 2,033,364천원 = 20.33억).
    행 위치는 시트마다 달라(9월 추정은 918행) 줄 번호가 아니라 라벨로 찾고, 같은 블록의 매출·원가 줄이
    프로젝트 행 합과 같을 때만 믿음 — 아니면 None(= 호출쪽이 예전처럼 추정 공통원가로 대체)."""
    try:
        label = raw["part"].fillna("").astype(str).str.strip().tolist()
        plan = pd.to_numeric(raw[col], errors="coerce").tolist()   # col: 계획 시트는 27 계획(jun_check_total)·26 추정(plan_initial) 둘 다 읽음
        hits = [i for i, v in enumerate(label) if v == "공통원가"]
        if len(hits) != 1 or hits[0] < 2:
            logger.warning("계획 공통원가: 합계 블록의 '공통원가' 줄을 못 찾음(%d곳) — 추정 공통원가로 대체", len(hits))
            return None
        i = hits[0]
        if label[i - 2] != "매출" or label[i - 1] != "원가":
            logger.warning("계획 공통원가: 공통원가 줄 위가 매출/원가 줄이 아님 — 추정 공통원가로 대체")
            return None
        rev_v, cost_v, ov = plan[i - 2], plan[i - 1], plan[i]
        if any(pd.isna(v) for v in (rev_v, cost_v, ov)) or ov <= 0:
            return None
        if abs(rev_v - rev_plan_sum) > 10 or abs(cost_v - cost_plan_sum) > 10:
            logger.warning("계획 공통원가: 합계 블록 매출/원가(%.0f/%.0f)가 프로젝트 행 합(%.0f/%.0f)과 다름 — 추정 공통원가로 대체",
                           rev_v, cost_v, rev_plan_sum, cost_plan_sum)
            return None
        return float(ov)
    except Exception:
        logger.warning("계획 공통원가 읽기 실패 — 추정 공통원가로 대체", exc_info=True)
        return None


def _plan_mgmt_profit_from_block(raw: "pd.DataFrame", rev_plan_sum: float, cost_plan_sum: float, col: str = "plan_initial") -> "dict[str, float] | None":
    """사업계획(최초사업계획 열) 기준 관리비·경상손익·인건비 — _plan_overhead_from_block과 같은 합계 블록
    (구분 열에 매출 / 원가 / 공통원가 / 인건비 / 자산 / 관리비 / 손익 순)의 '관리비'·'손익' 줄 값(천원). 2026-10-27.
    9월 집계 실측: 관리비 4,430,525(44.31억) · 손익 953,426(9.53억). 손익 = 매출 − 원가 − 공통원가 − 인건비 − 관리비
    (자산 줄은 손익 계산에 안 들어감 — 321.29 − 193.51 − 20.33 − 53.61 − 44.31 = 9.53억으로 대조).
    블록 라벨 순서·매출/원가 합 일치·위 항등식이 모두 맞을 때만 믿음 — 아니면 None(= 호출쪽이 계획 칸을 비움).
    계획 경상손익은 프로젝트 행에 없는 값이라 대체할 추정값이 없음(추정으로 채우면 계획=추정이 돼 오해)."""
    try:
        label = raw["part"].fillna("").astype(str).str.strip().tolist()
        plan = pd.to_numeric(raw[col], errors="coerce").tolist()
        hits = [i for i, v in enumerate(label) if v == "공통원가"]
        if len(hits) != 1 or hits[0] < 2 or hits[0] + 4 >= len(label):
            logger.warning("계획 관리비·경상손익: 합계 블록의 '공통원가' 줄을 못 찾음(%d곳) — 계획 칸 비움", len(hits))
            return None
        i = hits[0]
        if [label[i - 2], label[i - 1], label[i + 1], label[i + 2], label[i + 3], label[i + 4]] != ["매출", "원가", "인건비", "자산", "관리비", "손익"]:
            logger.warning("계획 관리비·경상손익: 합계 블록 줄 순서가 다름 — 계획 칸 비움")
            return None
        rev_v, cost_v, ov, labor, _asset, mgmt, profit = plan[i - 2], plan[i - 1], plan[i], plan[i + 1], plan[i + 2], plan[i + 3], plan[i + 4]
        if any(pd.isna(v) for v in (rev_v, cost_v, ov, labor, mgmt, profit)):
            return None
        if abs(rev_v - rev_plan_sum) > 10 or abs(cost_v - cost_plan_sum) > 10:
            logger.warning("계획 관리비·경상손익: 합계 블록 매출/원가(%.0f/%.0f)가 프로젝트 행 합(%.0f/%.0f)과 다름 — 계획 칸 비움",
                           rev_v, cost_v, rev_plan_sum, cost_plan_sum)
            return None
        if abs((rev_v - cost_v - ov - labor - mgmt) - profit) > 100:
            logger.warning("계획 관리비·경상손익: 매출−원가−공통원가−인건비−관리비(%.0f)가 손익 줄(%.0f)과 다름 — 계획 칸 비움",
                           rev_v - cost_v - ov - labor - mgmt, profit)
            return None
        return {"mgmt": float(mgmt), "profit": float(profit), "labor": float(labor)}
    except Exception:
        logger.warning("계획 관리비·경상손익 읽기 실패 — 계획 칸 비움", exc_info=True)
        return None


def read_perf_frame(path: str, sheet: "str | None" = None, col_map: "dict | None" = None, view: "str | None" = None):
    """실적 엑셀 한 시트를 읽어 정리한 DataFrame + (시트명, 연, 월). 캐시·전역값은 안 건드림 —
    load_perf_excel(대시보드 캐시)과 업로드 검증(perf_upload)이 같은 규칙으로 읽게 공용(2026-10-14).
    sheet 생략 = 최신 시트 자동 선택, col_map 생략 = perf_col_map(sheet).
    view(2026-10-29): "actual"(N월 집계/추정 시트) / "plan27"(사업계획 시트 — 기준월·누계 없음, 월은 0으로 돌려줌).
    생략하면 시트 이름으로 정함(계획 시트 이름이면 plan27)."""
    _perf_engine = "pyxlsb" if path.endswith(".xlsb") else "openpyxl"
    with pd.ExcelFile(path, engine=_perf_engine) as xf:
        if sheet:
            resolved_sheet = sheet
        elif view == "plan27":
            resolved_sheet = _resolve_plan_sheet(xf.sheet_names)
            if not resolved_sheet:
                raise ValueError(f"사업계획 시트(연도 + '계획')를 찾을 수 없습니다. 시트 목록: {list(xf.sheet_names)}")
        else:
            resolved_sheet = _resolve_perf_sheet(xf.sheet_names)
        view = view or ("plan27" if is_plan_sheet(resolved_sheet) else "actual")
        logger.info("실적 시트 선택: %s (%s)", resolved_sheet, view)

        col_map = col_map or perf_col_map(resolved_sheet)
        if not col_map:
            raise ValueError(
                f"시트 '{resolved_sheet}'에 대한 컬럼맵이 없습니다. 관리자 기능 > 실적현황 파일 업데이트로 올리면 "
                f"자동으로 맞춰 주고, 수동이면 scripts/check_perf_headers.py로 헤더를 확인해 _PERF_COL_MAPS에 추가하세요."
            )
        col_indices = sorted(col_map.keys())
        df = xf.parse(
            resolved_sheet,
            header=None,
            skiprows=12,
            usecols=col_indices,
        )
    df.columns = [col_map[i] for i in col_indices]
    if view == "plan27":
        # 계획 시트엔 없는 실적 전용 필드(jun_actual·jun_est 등)는 빈 열로 — 표·병합 코드가 열 이름을 그대로 찾아서 KeyError가 안 나게
        for _f in sorted(_ALL_PERF_FIELDS - set(df.columns)):
            df[_f] = np.nan

    # 프로젝트코드(O열)가 비어있어도 실제 매출/원가가 있는 행이면 집계에서 빠지면 안 됨
    # (2026-09-14 실측: K뉴딜 아카데미 2건이 코드 미기재로 통째로 누락돼 실적현황 합계가
    #  23.6억 적게 잡히는 문제 확인). 코드가 비면 프로젝트명으로 대체해서 식별자로 쓰고,
    # 상세 테이블(api_perf_data)에도 이 대체값이 그대로 노출된다.
    # (2026-10-14 "프로젝트명_파트명"으로 바꿨다가 같은 날 원복 — 프로젝트명만. 되살리려면 아래 주석 블록)
    df["project_code"] = df["project_code"].fillna("").astype(str).str.strip()
    df["project_code"] = df["project_code"].replace({"nan": "", "<NA>": "", "NaN": ""})
    df["project_name"] = df["project_name"].fillna("").astype(str).str.strip()
    df["project_name"] = df["project_name"].replace({"nan": "", "<NA>": "", "NaN": ""})
    blank_code = df["project_code"] == ""
    if blank_code.any():
        logger.warning(
            "프로젝트코드 미기재 %d행 — 프로젝트명으로 대체 (use_yn/category 필터 전 집계, "
            "실제 반영분은 이보다 적음)", int(blank_code.sum()),
        )
        df.loc[blank_code, "project_code"] = df.loc[blank_code, "project_name"]
        # part_txt = df.loc[blank_code, "part"].fillna("").astype(str).map(lambda v: PART_PREFIX_RE.sub("", v).strip())
        # part_txt = part_txt.replace({"nan": ""})
        # df.loc[blank_code, "project_code"] = (
        #     df.loc[blank_code, "project_name"] + part_txt.map(lambda v: f"_{v}" if v else ""))
    raw_df = df   # 필터 전 — 시트 아래쪽 합계 블록(공통원가 계획값)을 찾는 데 씀(_plan_overhead_from_block)
    df["use_yn"] = df["use_yn"].astype(str).str.strip()
    df = df[df["use_yn"] == "사용"]
    df = df[df["category"].isin(["매출", "원가"])]
    # 코드도 이름도 둘 다 없는 완전 빈 행만 제외 (빈 줄/서식용 더미행 방지)
    df = df[df["project_code"] != ""]

    str_cols = [
        "tech_category", "team", "part", "biz_division", "biz_type", "customer_type",
        "biz_plan", "progress", "category", "edu_type", "budget_code", "project_code",
        "biz_type2", "budget_unit", "project_name", "manager",
        "cost_rate_reason", "plan_diff_reason", "change_note", "dup_check", "ref_code", "note",
    ]
    for col in str_cols:
        if col in df.columns:
            df[col] = df[col].fillna("").astype(str).str.strip()
            df[col] = df[col].replace({"nan": "", "<NA>": "", "NaN": ""})

    # K뉴딜TF 파트가 원본에 "⑦ K뉴딜TF" / "⑦ K뉴딜TF(SW)" / "⑦ K뉴딜TF(EM)" 3갈래로 나뉘어
    # 있음 — 사실상 같은 파트라 "⑦ K뉴딜TF"로 통합 (표기 채택본). by_part/options 등
    # 이 df["part"]를 그대로 groupby하는 모든 곳에 한 번에 반영됨.
    df["part"] = df["part"].str.replace(r"⑦ K뉴딜TF\(.+?\)", "⑦ K뉴딜TF", regex=True)

    num_cols = [
        "actual_2025", "plan_initial", "plan_cost_rate",
        "course_count", "session_count", "participant_count",
        "jun_est", "jun_est_rate", "jun_actual", "jun_cost_rate",
        "cost_rate_diff", "est_vs_actual",
        "plan_diff_amount", "plan_diff_rate",
        "profit_gross", "cost_direct", "cost_labor", "cost_overhead", "cost_mgmt",
        "operating_profit", "profit_rate_raw",
        "jun_check_total",
        "chk_m01","chk_m02","chk_m03","chk_m04","chk_m05","chk_m06",
        "chk_m07","chk_m08","chk_m09","chk_m10","chk_m11","chk_m12",
        "chk_cost_rate", "chk_course", "chk_session", "chk_participant",
        "balance_amount", "balance_rate",
        "sa_direct_total","sa_instructor","sa_sub_instructor","sa_venue",
        "sa_practice","sa_textbook","sa_other_direct",
        "sa_overhead_total","sa_refreshment","sa_edu_venue","sa_parking",
        "sa_sw_practice","sa_intern",
        "sa_labor_total","sa_regular","sa_overhead_cost",
    ]
    for col in num_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df["profit_rate"] = (df["profit_rate_raw"] * 100).round(1)
    df = df.drop(columns=["profit_rate_raw"])

    # ⚠️ jun_actual(AO열)은 엑셀 자체가 "1~12월 전체 합계"(미래월 추정치까지 포함)로 계산돼 있어
    #    "OO월 실적"이라는 이름과 달리 실제로는 연간 전체(실적+추정) 값이다.
    #    (jun_check_total=BE열도 동일 — AO==BE, 둘 다 chk_m01~chk_m12 전체 합)
    #    진짜 "이번 달까지의 실적"은 경과한 달(1~현재월)만 합산해야 하므로 여기서 보정한다.
    #    jun_check_total은 "N월 점검 연간합계"라는 이름 그대로 연간(전체) 값이 맞아 보정하지 않음.
    if view == "plan27":
        # 계획 시트는 실적이 아니라 jun_actual 재합산·누계 경상손익 재구성(아래)이 의미 없음 — 0으로 두고 마무리(월은 0 = 기준월 없음)
        _y = re.search(r"(\d{4})", resolved_sheet)
        df["jun_actual"] = 0.0
        df["acc_profit_gross"] = 0.0
        df["acc_operating_profit"] = 0.0
        return _finish_perf_frame(df, raw_df, path, view), resolved_sheet, (int(_y.group(1)) if _y else 0), 0

    sheet_month_match = _PERF_SHEET_RE.match(resolved_sheet)
    current_month_num = int(sheet_month_match.group(2))
    current_year = int(sheet_month_match.group(1))
    elapsed_month_cols = [f"chk_m{m:02d}" for m in range(1, current_month_num + 1)]
    df["jun_actual"] = df[elapsed_month_cols].sum(axis=1)
    logger.info(
        "jun_actual 보정: %d월까지(%s) 합산으로 재계산 (엑셀 AO열의 연간 전체값 대체)",
        current_month_num, ", ".join(elapsed_month_cols),
    )

    # ── 누계(1~현재월) 기준 경상손익 재구성 ──────────────────────────────
    # 엑셀의 경상손익(BF)은 100% 연간 기준이다: BF = AR − (BB+BC+BD+BE) 인데
    # AR(=BH)도, BB(=원가행 BH)도, BC~BE(=매출이익 BA × 배부율)도 전부 1~12월 값이다.
    # 그래서 "8월까지 실제로 얼마 남겼나"에 답할 수 있는 값이 원본에 아예 없다.
    #
    # 엑셀 원본 수식(BC/BD/BE)은 모두 `매출이익 × 배부율` 형태이고, 그 배부율은
    # (팀 × 교육형태)별 상수다(참조표 910~965행에서 SUMIFS로 조회. 226건 100% 검증).
    # 따라서 행별로 (BC+BD+BE) ÷ BA 로 배부율을 역산해, 같은 비율을 누계 매출이익에
    # 적용하면 동일한 회계 원칙(간접비는 매출이익에 비례 배부)으로 누계 손익을 만들 수 있다.
    #
    # 짝짓기는 엑셀 수식과 동일하게 "바로 아랫줄"을 원가행으로 본다(BB 수식이 AR14 참조).
    # 짝을 못 찾은 매출행은 직접원가 0으로 두어 과대계상되지 않게 한다.
    cat = df["category"].values
    acc_rev_all = df["jun_actual"].values          # 위에서 1~현재월로 보정된 값
    acc_direct = np.zeros(len(df))
    for i in range(len(df) - 1):
        if cat[i] == "매출" and cat[i + 1] == "원가":
            acc_direct[i] = acc_rev_all[i + 1]
    acc_gross = np.where(cat == "매출", acc_rev_all - acc_direct, 0.0)

    gross = df["profit_gross"].values                                    # BA (연간 매출이익)
    indirect = (df["cost_labor"] + df["cost_overhead"] + df["cost_mgmt"]).values  # BC+BD+BE
    with np.errstate(divide="ignore", invalid="ignore"):
        alloc_rate = np.where(gross > 0, indirect / np.where(gross == 0, 1, gross), 0.0)
    alloc_rate = np.nan_to_num(alloc_rate)

    # 엑셀이 IF(BA>0)로 적자행에 간접비를 안 물리는 것과 같은 규칙을 누계에도 적용
    df["acc_profit_gross"]     = acc_gross
    df["acc_operating_profit"] = np.where(acc_gross > 0, acc_gross * (1 - alloc_rate), acc_gross)
    logger.info(
        "누계 경상손익 재구성: 매출이익 %.1f억 → 경상손익 %.1f억 (역산 배부율 평균 %.1f%%)",
        acc_gross.sum() / 100_000,
        df["acc_operating_profit"].sum() / 100_000,
        alloc_rate[gross > 0].mean() * 100 if (gross > 0).any() else 0,
    )

    return _finish_perf_frame(df, raw_df, path, view), resolved_sheet, current_year, current_month_num


def _raw_category_sum(raw_df: pd.DataFrame, category: str, col: str) -> float:
    """필터(사용 여부 등) 전 원본 행에서 구분이 category인 행의 col 합 — 시트 맨 아래 합계 블록과 맞춰 보는 용도(계획 시트)"""
    cat = raw_df["category"].astype(str).str.strip()
    val = pd.to_numeric(raw_df[col], errors="coerce").fillna(0)
    return float(val[cat == category].sum())


def _finish_perf_frame(df: pd.DataFrame, raw_df: pd.DataFrame, path: str, view: str) -> pd.DataFrame:
    """read_perf_frame 마무리 — NaN→None, 파일명, 시트 맨 아래 합계 블록 값을 df.attrs에 붙임(실적·계획 공용)"""
    df = df.where(df.notna(), other=None)
    df["filename"] = os.path.basename(path)
    df.attrs["view"] = view
    if view == "plan27":
        # 계획 시트의 합계 블록(공통원가·인건비·관리비·손익 줄) — 27 계획(jun_check_total 열)과 26 추정(plan_initial 열) 두 열을 다 읽음.
        # 실적 시트는 블록 매출·원가가 '사용' 행 합과 같았지만 이 시트는 사용여부가 비거나 미사용인 행까지 합친 값(2026-10-29 실측: 매출 387.59억 vs 사용 행 387.49억,
        # 사용여부가 빈 1건 때문) → 비교 대상을 필터 전 전체 행 합으로. 못 읽으면 None(화면은 그 칸을 '-'로)
        blocks = {}
        for key, col in (("y27", "jun_check_total"), ("y26", "plan_initial")):
            rs, cs = _raw_category_sum(raw_df, "매출", col), _raw_category_sum(raw_df, "원가", col)
            extra = _plan_mgmt_profit_from_block(raw_df, rs, cs, col)
            overhead = _plan_overhead_from_block(raw_df, rs, cs, col)
            blocks[key] = ({"overhead": overhead, **extra} if extra else {"overhead": overhead}) if overhead is not None or extra else None
        df.attrs["plan_blocks"] = blocks
        return df
    # 사업계획 기준 공통원가(시트 합계 블록 W열) — 못 찾거나 검증 실패면 None(요약이 추정 공통원가로 대체)
    _rev_plan_sum  = float(df.loc[df["category"] == "매출", "plan_initial"].sum())
    _cost_plan_sum = float(df.loc[df["category"] == "원가", "plan_initial"].sum())
    df.attrs["plan_overhead"] = _plan_overhead_from_block(raw_df, _rev_plan_sum, _cost_plan_sum)
    # 사업계획 기준 관리비·경상손익(같은 블록, 2026-10-27) — 못 읽으면 None(계획 칸을 비움)
    df.attrs["plan_block_extra"] = _plan_mgmt_profit_from_block(raw_df, _rev_plan_sum, _cost_plan_sum)
    return df


def load_perf_excel():
    """_perf_cache_lock 보유 상태에서만 호출.
    data/의 실적 파일을 최신부터 시도(2026-10-14 자동 반영) — 처음 보는 파일은 perf_autoupdate.prepare로 열 맞추기·계산식 검증,
    실패하면 다음(직전) 파일로 계속 보여줌. 이미 검증한 파일(같은 경로·수정 시각)은 바로 읽음."""
    global _perf_cached_df, _perf_last_loaded, _perf_cached_mtime, _perf_current_month, _perf_current_year, PERF_EXCEL_PATH
    import perf_autoupdate
    from paths import perf_excel_candidates
    if not PERF_AUTO_UPDATE:
        return _load_perf_simple()
    cands = [c for c in (perf_excel_candidates() or [resolve_perf_excel()]) if os.path.exists(c)]
    if not cands:
        PERF_EXCEL_PATH = resolve_perf_excel()
        logger.warning("PERF_EXCEL_PATH 없음: %s", PERF_EXCEL_PATH)
        _perf_cached_df   = pd.DataFrame()
        _perf_last_loaded = None
        _perf_cached_mtime = None
        return _perf_cached_df

    status = perf_autoupdate.read_status()
    good = status.get("good") or {}
    errors = []
    for path in cands:
        mtime = safe_mtime(path)
        try:
            if good.get("file") == path and good.get("mtime") == mtime and perf_col_map(good.get("sheet", "")):
                df, sheet, year, month = read_perf_frame(path, good["sheet"])
            elif path != cands[0] and perf_col_map(perf_autoupdate_sheet(path) or ""):
                # 최신 파일이 실패해 내려온 직전 파일 — 이미 아는 시트면 그대로 읽음
                df, sheet, year, month = read_perf_frame(path)
            else:
                df, sheet, year, month, _ = perf_autoupdate.prepare(path, good)
        except Exception as e:
            errors.append(f"{os.path.basename(path)}: {e}")
            continue
        st = perf_autoupdate.read_status()
        st["good"] = {"file": path, "sheet": sheet, "mtime": mtime}
        st["serving"] = os.path.basename(path)
        st["serving_sheet"] = sheet
        perf_autoupdate.write_status(st)
        PERF_EXCEL_PATH = path
        _perf_current_year, _perf_current_month = year, month
        _perf_cached_df   = df
        _perf_last_loaded = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        _perf_cached_mtime = mtime
        if errors:
            logger.warning("최신 실적 파일 반영 실패 — 직전 파일(%s)로 표시: %s", os.path.basename(path), " | ".join(errors))
        logger.info("실적 엑셀 로드 완료: %d행 (매출 %d, 원가 %d)",
                    len(df),
                    int((df["category"] == "매출").sum()),
                    int((df["category"] == "원가").sum()))
        return df
    raise ValueError("읽을 수 있는 실적 파일이 없습니다 — " + " | ".join(errors))


def _load_perf_simple():
    """자동 반영을 끈 동안(PERF_AUTO_UPDATE=False) — 예전 방식: 파일 하나, 코드에 적은 맵(+예전에 학습한 맵)"""
    global _perf_cached_df, _perf_last_loaded, _perf_cached_mtime, _perf_current_month, _perf_current_year, PERF_EXCEL_PATH
    PERF_EXCEL_PATH = resolve_perf_excel()
    if not os.path.exists(PERF_EXCEL_PATH):
        logger.warning("PERF_EXCEL_PATH 없음: %s", PERF_EXCEL_PATH)
        _perf_cached_df   = pd.DataFrame()
        _perf_last_loaded = None
        _perf_cached_mtime = None
        return _perf_cached_df
    df, _, _perf_current_year, _perf_current_month = read_perf_frame(PERF_EXCEL_PATH)
    _perf_cached_df   = df
    _perf_last_loaded = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    _perf_cached_mtime = safe_mtime(PERF_EXCEL_PATH)
    logger.info("실적 엑셀 로드 완료: %d행 (매출 %d, 원가 %d)",
                len(df),
                int((df["category"] == "매출").sum()),
                int((df["category"] == "원가").sum()))
    return df


def perf_autoupdate_sheet(path: str) -> "str | None":
    """그 파일의 최신 시트 이름(못 읽으면 None)"""
    try:
        engine = "pyxlsb" if path.endswith(".xlsb") else "openpyxl"
        with pd.ExcelFile(path, engine=engine) as xf:
            return _resolve_perf_sheet(xf.sheet_names)
    except Exception:
        return None


def plan_sheet_of(path: str) -> "str | None":
    """그 파일의 사업계획 시트 이름(없거나 못 읽으면 None)"""
    try:
        engine = "pyxlsb" if path.endswith(".xlsb") else "openpyxl"
        with pd.ExcelFile(path, engine=engine) as xf:
            return _resolve_plan_sheet(xf.sheet_names)
    except Exception:
        return None


def load_plan_excel() -> pd.DataFrame:
    """_plan_cache_lock 보유 상태에서만 호출. 계획 뷰(plan27) 읽기 — data/의 실적 파일을 최신부터 보며 사업계획 시트가 있는 첫 파일을 씀.
    실적 뷰(load_perf_excel)와 같은 방식(처음 보는 파일은 perf_autoupdate.prepare로 열 맞추기·계산식 검증, 실패하면 다음 파일)이고
    상태는 perf_update_status.json의 "plan27" 키에 따로 기록(실적 상태를 안 덮어씀).
    계획 시트가 하나도 없으면 오류가 아니라 빈 결과(= 화면의 계획 보기 전환이 안 보임)."""
    import perf_autoupdate
    from paths import perf_excel_candidates
    cands = [c for c in (perf_excel_candidates() or [resolve_perf_excel()]) if os.path.exists(c)]
    _plan_cache["seen"] = (cands[0], safe_mtime(cands[0])) if cands else None
    status = perf_autoupdate.read_status("plan27")
    good = status.get("good") or {}
    errors = []
    for path in cands:
        sheet = plan_sheet_of(path)
        if not sheet:
            continue   # 이 파일엔 계획 시트가 없음 — 오류 아님, 다음(직전) 파일을 봄
        mtime = safe_mtime(path)
        try:
            if good.get("file") == path and good.get("mtime") == mtime and perf_col_map(good.get("sheet", "")):
                df, sheet, year, _ = read_perf_frame(path, good["sheet"], view="plan27")
            elif not PERF_AUTO_UPDATE:
                df, sheet, year, _ = read_perf_frame(path, sheet, view="plan27")
            else:
                df, sheet, year, _, _ = perf_autoupdate.prepare(path, good, view="plan27")
        except Exception as e:
            errors.append(f"{os.path.basename(path)}: {e}")
            continue
        st = perf_autoupdate.read_status("plan27")
        st["good"] = {"file": path, "sheet": sheet, "mtime": mtime}
        st["serving"] = os.path.basename(path)
        st["serving_sheet"] = sheet
        perf_autoupdate.write_status(st, "plan27")
        _plan_cache.update(df=df, path=path, mtime=mtime, year=year, sheet=sheet,
                           loaded=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        if errors:
            logger.warning("최신 계획 시트 반영 실패 — 직전 파일(%s)로 표시: %s", os.path.basename(path), " | ".join(errors))
        logger.info("사업계획 시트 로드 완료: %s / %s — %d행", os.path.basename(path), sheet, len(df))
        return df
    _plan_cache.update(df=pd.DataFrame(), path=None, mtime=None, year=0, sheet=None, loaded=None)
    if errors:
        raise ValueError("읽을 수 있는 사업계획 시트가 없습니다 — " + " | ".join(errors))
    return _plan_cache["df"]


def get_plan_df() -> pd.DataFrame:
    """계획 뷰 프레임(캐시) — 파일 mtime이 바뀌거나 data/에 새 파일이 들어오면 다시 읽음(5초마다 확인).
    최신 파일에 계획 시트가 없거나 검증에 실패한 경우는 seen으로 기억해 같은 파일을 반복해서 다시 열지 않음"""
    import time
    c = _plan_cache
    newest = resolve_perf_excel()
    if time.time() - c.get("_checked", 0) > 5:
        c["_checked"] = time.time()
        stale = c["seen"] != (newest, safe_mtime(newest))
    else:
        stale = False
    if not stale and c["path"] and safe_mtime(c["path"]) != c["mtime"]:
        stale = True
    if not stale:
        return c["df"]
    with _plan_cache_lock:
        try:
            load_plan_excel()
        except Exception as e:
            logger.error("load_plan_excel() 실패: %s", e)
            c.update(df=pd.DataFrame(), path=None, mtime=None, year=0, sheet=None, loaded=None)
    return c["df"]


_perf_newest_checked = 0.0   # data/에 새 파일이 들어왔는지 보는 시각(5초 간격)


def get_perf_df(view: str = "actual") -> pd.DataFrame:
    """파일 mtime이 바뀌거나 data/에 더 최신 실적 파일이 들어오면 자동으로 다시 읽는다.
    view="plan27"이면 사업계획 시트 프레임(get_plan_df) — 기본값 "actual"이라 인자 없는 기존 호출은 그대로(테스트도 인자 없는 함수로 바꿔치기함)"""
    if view == "plan27":
        return get_plan_df()
    global _perf_cached_df, _perf_cached_mtime, _perf_newest_checked
    import time
    newer = False
    if PERF_AUTO_UPDATE and time.time() - _perf_newest_checked > 5:
        _perf_newest_checked = time.time()
        newer = resolve_perf_excel() != PERF_EXCEL_PATH and not _perf_failed_newest()
    current_mtime = safe_mtime(PERF_EXCEL_PATH)
    if not newer and not _perf_cached_df.empty and current_mtime == _perf_cached_mtime:
        return _perf_cached_df
    with _perf_cache_lock:
        current_mtime = safe_mtime(PERF_EXCEL_PATH)
        if newer or _perf_cached_df.empty or current_mtime != _perf_cached_mtime:
            try:
                load_perf_excel()
            except Exception as e:
                logger.error("load_perf_excel() 실패: %s", e)
                _perf_cached_df    = pd.DataFrame()
                _perf_cached_mtime = current_mtime
    return _perf_cached_df


def _perf_failed_newest() -> bool:
    """최신 파일이 이미 검증에 실패했고 그 뒤로 안 바뀌었으면 True — 5초마다 다시 시도(H-chat 호출 포함)하지 않게"""
    import perf_autoupdate
    st = perf_autoupdate.read_status()
    newest = resolve_perf_excel()
    return (not st.get("ok") and st.get("file") == os.path.basename(newest)
            and st.get("failed_mtime") == safe_mtime(newest))


_PROGRESS_PRIORITY = ["제안", "협의", "착수", "중간", "완료", "인큐베이팅", "이월", "드롭", "미정"]


# K뉴딜TF는 원본에서 행마다 팀(SW·전동화/모빌리티·기획)이 적혀 있음 — 팀을 고르면 그 팀 몫 K뉴딜TF 행만(2026-10-21 요청).
# 2026-10-20엔 팀을 고르면 K뉴딜TF를 통째로 뺐음(_TEAMLESS_PARTS) — 도넛이 "팀 = 소속 파트 전체 합"이라 세 팀 몫이 다 더해지던 게
# 진짜 원인이어서, 도넛은 행의 팀 기준(by_team)으로 바꾸고 제외는 없앰. 팀 "전체"에 K뉴딜TF만 고르면 세 팀 몫이 다 나옴

def apply_perf_filters(df: pd.DataFrame) -> pd.DataFrame:
    parts = request.args.getlist("part")
    team  = request.args.get("team", "")
    if parts:
        stripped_part = df["part"].astype(str).apply(lambda p: PART_PREFIX_RE.sub("", p))
        df = df[stripped_part.isin(parts)]
    if team:
        df = df[df["team"] == team]
    return df


def request_view() -> str:
    """요청의 ?view= — "actual"(기본, 실적) / "plan27"(2027 사업계획). 모르는 값은 실적으로"""
    v = request.args.get("view", "actual").strip()
    return v if v in PERF_VIEWS else "actual"


def _df_for_request() -> pd.DataFrame:
    """요청한 뷰의 프레임. 실적은 인자 없이 호출(테스트가 인자 없는 함수로 get_perf_df를 바꿔치기함 — test_headcount)"""
    return get_perf_df("plan27") if request_view() == "plan27" else get_perf_df()


def _weighted_profit_rate(group) -> float:
    """손익률 = 경상손익 합계 / 매출 합계 × 100.

    ⚠️ 이전에는 profit_rate > 0 인 행만 골라 단순평균해서 **구조적으로 음수가 나올 수 없었다**
       (경상손익이 마이너스인 파트도 이익율은 플러스로 표시되던 버그).
       금액 기준으로 집계해야 이익액 부호와 항상 일치한다.
    """
    base = float(group["jun_check_total"].sum())
    if not base:
        return 0.0
    return round(float(group["operating_profit"].sum()) / base * 100, 1)


def _acc_profit_rate(group) -> float:
    """누계 손익률 = 누계 경상손익 합계 / 누계 매출 합계 × 100.

    연간 기준 _weighted_profit_rate와 같은 '합계 ÷ 합계' 방식이되, 분자·분모를
    모두 누계(1~기준월)로 맞춘다. 분모가 연간이면 손익률이 부풀려지므로 반드시 짝을 맞출 것.
    """
    base = float(group["jun_actual"].sum())
    if not base:
        return 0.0
    return round(float(group["acc_operating_profit"].sum()) / base * 100, 1)


def _bil_perf(v) -> str:
    """실적현황 데이터는 천원 단위 저장 — 억원 단위 문자열로 변환."""
    return f"{v / 100_000:.1f}".replace("-0.0", "0.0") + "억원"


def _ratio(numer: float, denom: float) -> "float | None":
    """비율(%) — 분모가 0 이하면 None(프론트에서 '-' 표시). 계산은 전부 여기(백엔드)에서."""
    return round(numer / denom * 100, 1) if denom and denom > 0 else None


# ──────────────────────────────────────────────────────────────
# 실적현황 API
# ──────────────────────────────────────────────────────────────

@perf_bp.route("/api/performance/options")
def api_perf_options():
    df = _df_for_request()
    if df.empty:
        return jsonify({"parts": [], "teams": [], "team_parts": {}, "progress": [], "managers": []})
    parts = sorted(df["part"].dropna().unique().tolist())
    teams = sorted(df["team"].dropna().unique().tolist())
    # 진행단계 — 값 종류가 적고 고정적(제안/착수/완료/드롭 등)이라 자유 검색보다 셀렉트박스가
    # 맞음(2026-09-21 요청). _PROGRESS_PRIORITY 순서로 보여주고, 목록에 없는 값은 뒤에 덧붙임
    progress_present = set(df["progress"].dropna().unique().tolist())
    progress = [p for p in _PROGRESS_PRIORITY if p in progress_present] + \
        sorted(p for p in progress_present if p not in _PROGRESS_PRIORITY)
    # 팀 → 그 팀 소속 파트 목록 — 원가 비율 카드에서 "팀 고르면 파트가 좁혀지는" 용도
    team_parts = {
        team: sorted(g["part"].dropna().unique().tolist())
        for team, g in df.dropna(subset=["team"]).groupby("team")
    }
    # 담당자 — 프로젝트 상세 열 필터의 고르기 목록(2026-10-14)
    managers = sorted(str(m).strip() for m in df["manager"].dropna().unique() if str(m).strip())
    return jsonify({"parts": parts, "teams": teams, "team_parts": team_parts, "progress": progress, "managers": managers})


# 매출행·원가행 값이 서로 다른(원가행에도 값이 있는) 필드 — 한 줄로 합칠 때 원가행 값을 `cost__<필드>`로 따로 싣는다.
# 프론트는 이 필드들을 "(매출)/(원가)" 두 컬럼으로 나눠 보여줌(2026-10-02 요청).
# 2026-10-02 실데이터 298쌍 전수 확인 기준. 원가행이 항상 0/빈 값인 필드(손익·원가 구성·원가율 등)는 매출행 전용이라 제외.
# 과정·차수·인원(계획·점검)·계획 대비 차이 금액(AX)은 원가행에도 값이 있지만 무조건 매출행 기준(2026-10-02 요청)이라 제외
PERF_COST_SIDE_FIELDS = [
    "plan_initial", "jun_check_total", "actual_2025", "budget_code", "biz_type2",
    "jun_est", "jun_actual", "est_vs_actual", "cost_rate_reason",
    "plan_diff_rate", "plan_diff_reason",
    "change_note",
    "balance_amount", "balance_rate", "dup_check", "ref_code",
    "sa_direct_total", "sa_instructor", "sa_sub_instructor", "sa_venue", "sa_practice", "sa_textbook",
    "sa_other_direct", "sa_overhead_total", "sa_refreshment", "sa_edu_venue", "sa_parking",
    "sa_sw_practice", "sa_intern", "sa_labor_total", "sa_regular", "sa_overhead_cost", "note",
]
# 매출행·원가행이 항상 같은 식별 필드 — 원가행만 있는 줄에서도 이건 채운다
_PERF_SHARED_FIELDS = [
    "tech_category", "team", "part", "use_yn", "biz_division", "biz_type", "customer_type", "biz_plan",
    "progress", "edu_type", "project_code", "project_name", "manager", "filename", "_row_num",
]


def _merge_rev_cost_rows(rows: pd.DataFrame, group_no: pd.Series) -> pd.DataFrame:
    """매출행 + 바로 뒤 원가행을 한 줄로 — 프로젝트 상세 표용.

    한 묶음(group_no) 안에서 매출행이 나올 때마다 새 줄을 시작하고, 이어지는 원가행 하나를 그 줄에 붙인다.
    대부분은 매출+원가 1쌍이지만 실데이터엔 한 묶음에 쌍이 둘(K뉴딜 아카데미), 매출만 둘(전기오류 일괄 인식),
    원가만 있는 묶음(매출·원가행 프로젝트명 오타)도 있어 쌍 단위로 자른다.
    - 기본 필드는 매출행 값, 원가행 값은 PERF_COST_SIDE_FIELDS에 한해 `cost__<필드>`로
    - plan_cost = 원가행 사업계획(V열)
    - est_cost  = 당월 추정 직접원가 = 원가행 BH, est_gross = 매출 이익 = 매출행 BH − 원가행 BH(엑셀 AR17 − AR18과 같은 식).
      2026-10-02 사용자 정의대로 원가행에서 직접 읽음 — 매출행 BB(cost_direct)·BA(profit_gross)와 298쌍 전부 같은 값이었지만
      한쪽만 손으로 고치면 어긋날 수 있어서. 짝이 없으면(매출행만) 둘 다 비움
    - 원가행만 있는 줄: 식별 필드 + cost__*·est_cost 만 채우고 매출 쪽 값은 비움
    - _group_no = 줄 일련번호(페이지를 자르기 전 전체 기준 — 2페이지에서도 NO.가 이어짐)
    """
    if rows.empty:
        return rows.assign(plan_cost=[], _group_no=[])
    cat = rows["category"]
    new_pair = (group_no != group_no.shift()) | (cat == "매출") | (cat.shift() == "원가")
    pair_id = new_pair.cumsum()
    side_fields = [f for f in PERF_COST_SIDE_FIELDS if f in rows.columns]

    out = []
    for pid, sub in rows.groupby(pair_id, sort=True):
        rev  = sub[sub["category"] == "매출"]
        cost = sub[sub["category"] == "원가"]
        c = cost.iloc[0] if len(cost) else None
        if len(rev):
            rec = rev.iloc[0].to_dict()
        else:
            rec = {f: (c[f] if f in _PERF_SHARED_FIELDS else None) for f in rows.columns}
            rec["category"] = "원가"
        for f in side_fields:
            rec[f"cost__{f}"] = c[f] if c is not None else None
        rec["plan_cost"] = rec["cost__plan_initial"]
        rec["est_cost"]  = c["jun_check_total"] if c is not None else None
        rev_bh = rec.get("jun_check_total")
        rec["est_gross"] = (float(rev_bh) - float(c["jun_check_total"])
                            if c is not None and pd.notna(rev_bh) and pd.notna(c["jun_check_total"]) else None)
        rec["_group_no"] = int(pid)
        out.append(rec)
    return pd.DataFrame(out)


# 완료 프로젝트 — 실적현황 vs 재무 이력(PPT 추출, 완료 단계) 매출·원가 대조(2026-10-02 요청).
# 매출 = 당월 추정 매출(매출행 BH, jun_check_total) ↔ 재무 revenue / 원가 = 당월 추정 직접원가(원가행 BH, est_cost) ↔ 재무 direct_cost.
# 실적현황은 천원, 재무는 원 단위. 차이 1,000원 미만은 PPT 표의 천원 반올림이라 같은 값으로 봄
# (실측: -277·443·-167·208·-186원 같은 차이가 그 경우). 재무 완료 이력이 없으면 비교 안 함
_FIN_COMPARE_TOLERANCE_WON = 1000
_FIN_COMPARE_FIELDS = (("jun_check_total", "revenue"), ("est_cost", "direct_cost"))


def _attach_start_cost_over(rows: pd.DataFrame, idx, code: str, fin_start: pd.DataFrame) -> None:
    """완료 줄 — 당월 추정 직접원가(원가행 BH)가 재무 이력 착수 단계 직접원가보다 크거나 같으면 fin_cost_over_start.
    같음은 PPT 천원 반올림 때문에 1,000원 미만 차이까지(재무 대조와 같은 기준). 착수 직접원가가 0·빈 값이면 비교 안 함(2026-10-14)"""
    if code not in fin_start.index:
        return
    sv, pv = fin_start.loc[code]["direct_cost"], rows.at[idx, "est_cost"]
    if pd.isna(sv) or float(sv) <= 0 or pd.isna(pv):
        return
    rows.at[idx, "fin_start_est_cost"] = float(sv) / 1000
    if float(pv) * 1000 - float(sv) > -_FIN_COMPARE_TOLERANCE_WON:
        rows.at[idx, "fin_cost_over_start"] = True
        rows.at[idx, "fin_start_filename"] = str(fin_start.loc[code].get("filename", "") or "")


def _attach_finance_mismatch(rows: pd.DataFrame) -> pd.DataFrame:
    """진행 '완료' 줄에 재무 완료 단계 값(fin_<필드>, 천원)과 다른 필드 목록(fin_mismatch)을 붙인다.
    착수 단계 직접원가 대비 초과 여부(fin_cost_over_start·fin_start_est_cost)도 같이(_attach_start_cost_over)."""
    rows = rows.copy()
    rows["fin_mismatch"] = [[] for _ in range(len(rows))]
    if rows.empty:
        return rows
    try:
        import finance
        fdf = finance.get_df()
    except Exception:
        logger.warning("재무 이력 대조 실패 — 재무 데이터를 읽지 못함", exc_info=True)
        return rows
    if fdf.empty:
        return rows
    fin_done  = fdf[fdf["stage"] == "완료"].drop_duplicates("project_code", keep="last").set_index("project_code")
    fin_start = fdf[fdf["stage"] == "착수"].drop_duplicates("project_code", keep="last").set_index("project_code")
    done_mask = rows["progress"] == "완료"
    for idx in rows.index[done_mask]:
        code = str(rows.at[idx, "project_code"]).strip()
        _attach_start_cost_over(rows, idx, code, fin_start)
        if code not in fin_done.index:
            continue
        f = fin_done.loc[code]
        diff = []
        for perf_f, fin_f in _FIN_COMPARE_FIELDS:
            pv, fv = rows.at[idx, perf_f], f[fin_f]
            if pd.isna(pv) or pd.isna(fv):
                continue
            rows.at[idx, f"fin_{perf_f}"] = float(fv) / 1000
            if abs(float(pv) * 1000 - float(fv)) >= _FIN_COMPARE_TOLERANCE_WON:
                diff.append(perf_f)
        rows.at[idx, "fin_mismatch"] = diff
        if diff:
            rows.at[idx, "fin_filename"] = str(f.get("filename", "") or "")
    return rows


def _project_rows(rows: pd.DataFrame, with_finance: bool = True) -> pd.DataFrame:
    """매출행+원가행 → 프로젝트당 1행 + 완료 프로젝트 재무 대조. 프로젝트 상세 표·불일치 목록 공용.
    with_finance=False(계획 뷰): 재무 이력 대조 생략 — 대조 대상이 '당월 추정 매출·직접원가'인데 계획 시트 값은 27 계획이라 의미가 없음(빈 fin_mismatch만 채움)"""
    if rows.empty:
        return rows
    # 묶음(프로젝트) 일련번호 — 매출/원가 2행이 한 묶음이라 행 번호로는 NO.가 어긋난다.
    # 페이지를 자르기 **전에** 전체 기준으로 매겨야 2페이지에서도 번호가 이어짐.
    # project_code 단독 비교는 "생성예정"/"드롭"/"미생성" 같은 placeholder 코드가 서로
    # 다른 프로젝트끼리 같은 텍스트를 공유해서(같은 파트 안에 연달아 있으면 특히) 엉뚱하게
    # 한 묶음으로 잡히는 문제가 있음 — 그래서 placeholder 코드만 project_name까지 같이 본다.
    #
    # 반대로 정식 코드(영문 1자 + 숫자 10자 이상)에 project_name까지 묶으면, 원본 엑셀에서
    # 매출행/원가행 프로젝트명이 한 글자라도 다르게 입력된 경우(예: H093600126020002 —
    # "…홍보 자료 개발" vs "…안내 자료 개발") 같은 프로젝트가 두 묶음으로 쪼개진다.
    # 정식 코드를 공유하는 서로 다른 프로젝트(E078600126010001 등 4건)는 시트에서 멀리
    # 떨어져 있고, 묶음은 **연속된 행**끼리만 만들어지므로 코드만으로 묶어도 섞이지 않는다.
    code = rows["project_code"].astype(str).str.strip()
    is_real_code = code.str.fullmatch(r"[A-Za-z]\d{10,}").fillna(False)
    # 코드가 빈(→ 프로젝트명으로 대체된) 행·placeholder는 팀까지 키에 넣음 — K뉴딜 아카데미처럼 같은 이름 프로젝트가
    # 팀마다 따로 있고 시트에 붙어 있으면 한 묶음으로 합쳐졌음(2026-10-21). 화면엔 안 보이는 내부 키, 매달 같은 값(UUID 안 씀)
    group_key = code.where(is_real_code, code + "␟" + rows["project_name"].astype(str) + "␟" + rows["team"].astype(str))
    group_no = (group_key != group_key.shift()).cumsum()
    rows = _merge_rev_cost_rows(rows, group_no)
    if not with_finance:
        rows = rows.copy()
        rows["fin_mismatch"] = [[] for _ in range(len(rows))]
        return rows
    return _attach_finance_mismatch(rows)


# 열 필터의 숫자 단위 → 데이터 단위. 실적 금액은 천원이라 '억' 입력값 × 100,000
_CF_UNIT_SCALE = {"eok": 100_000, "pct": 1, "num": 1}


def apply_column_filters(rows: pd.DataFrame, raw: str) -> pd.DataFrame:
    """표 머리글 필터(2026-10-14). raw = JSON 배열
      {"id": 열, "type": "text", "q": "부분일치"}
      {"id": 열, "type": "select", "values": [...]}            — 파트는 원문자(①~) 뗀 값으로도 맞춤
      {"id": 열, "type": "number", "unit": "eok"|"pct", "min": 2.1, "max": null}  — 이상/이하, 빈 값은 제외
    모르는 열·잘못된 값은 무시(표가 깨지지 않게)."""
    if not raw or rows.empty:
        return rows
    import json
    try:
        specs = json.loads(raw)
    except ValueError:
        logger.warning("열 필터 해석 실패 — 무시: %r", raw[:200])
        return rows
    if not isinstance(specs, list):
        return rows
    mask = pd.Series(True, index=rows.index)
    for f in specs:
        if not isinstance(f, dict) or f.get("id") not in rows.columns:
            continue
        col = rows[f["id"]]
        kind = f.get("type")
        if kind == "text":
            q = str(f.get("q") or "").strip().lower()
            if q:
                mask &= col.astype(str).str.lower().str.contains(q, regex=False, na=False)
        elif kind == "select":
            values = {str(v) for v in (f.get("values") or [])}
            if values:
                text = col.fillna("").astype(str)
                mask &= text.isin(values) | text.map(lambda v: PART_PREFIX_RE.sub("", v).strip()).isin(values)
        elif kind == "number":
            scale = _CF_UNIT_SCALE.get(f.get("unit"), 1)
            num = pd.to_numeric(col, errors="coerce")
            lo, hi = f.get("min"), f.get("max")
            if isinstance(lo, (int, float)):
                mask &= num >= lo * scale - 1e-9
            if isinstance(hi, (int, float)):
                mask &= num <= hi * scale + 1e-9
    return rows[mask]


def _perf_detail_frame() -> pd.DataFrame:
    """프로젝트 상세 표의 행 — 필터·진행단계·검색·프로젝트당 1행·재무 대조·정렬까지(페이지 자르기 전).
    표 조회(/data)와 엑셀 다운로드(/data/export)가 같은 행을 쓰게 공용(2026-10-14)"""
    df = apply_perf_filters(_df_for_request())
    if df.empty:
        return df
    # 프로젝트당 한 줄 — 엑셀은 매출행+원가행 2행이지만 표에선 매출행에 원가행의 사업계획 원가(plan_cost)를
    # 붙여 한 줄로 내려준다(2026-10-02 요청, 예전엔 2행 + 프론트 세로 병합). 집계(summary)는 계속 rev/cost 분리.
    rows = df.copy()
    rows["_row_num"] = rows.index

    # 진행단계 — 값 종류가 적고 고정적이라(제안/착수/완료/드롭 등) 자유 검색 대신 셀렉트박스로
    # 정확히 골라서 필터링(2026-09-21 요청). 검색(search)과 별개로 항상 적용됨
    progress = request.args.get("progress", "").strip()
    if progress:
        rows = rows[rows["progress"] == progress]

    search   = request.args.get("search", "").strip()
    field    = request.args.get("field", "").strip()
    str_cols = ["project_code", "project_name", "manager", "part", "team", "progress"]
    if search:
        s = search.lower()
        if field in str_cols and field in rows.columns:
            mask = rows[field].astype(str).str.lower().str.contains(s, regex=False, na=False)
        else:
            mask = pd.Series([False] * len(rows), index=rows.index)
            for col in str_cols:
                if col in rows.columns:
                    mask |= rows[col].astype(str).str.lower().str.contains(s, regex=False, na=False)
        rows = rows[mask]

    rows = _project_rows(rows, with_finance=request_view() == "actual")
    # 열 필터(표 머리글 깔때기) — 합친 뒤 계산되는 열(당월 추정 직접원가·매출 이익 등)도 걸려야 해서 _project_rows 다음
    rows = apply_column_filters(rows, request.args.get("cf", ""))
    # 전체 기준 정렬(표 머리글 클릭) — 페이지를 자르기 전에
    return sort_frame(rows, request.args.get("sort_by", ""), request.args.get("sort_dir", "asc"))


@perf_bp.route("/api/performance/data")
def api_perf_data():
    rows = _perf_detail_frame()
    if rows.empty:
        return jsonify({"data": [], "total": 0})
    total = len(rows)

    try:
        page      = max(1, int(request.args.get("page", 1)))
        page_size = min(200, max(1, int(request.args.get("page_size", 30))))
    except (ValueError, TypeError):
        page, page_size = 1, 30

    start = (page - 1) * page_size
    # 빈 칸(원가 짝 없음·재무 대조 대상 아님 등)은 NaN으로 남는데, NaN은 JSON이 아니라 브라우저가 응답 전체를 못 읽음
    # (2026-10-02 표가 "0건"으로 보였던 원인) → None(null)으로 바꿔 보냄
    page_df = rows.iloc[start:start + page_size]
    page_df = page_df.astype(object).where(pd.notna(page_df), None)
    return jsonify({"data": page_df.to_dict(orient="records"), "total": total})


@perf_bp.route("/api/performance/data/export")
def api_perf_data_export():
    """프로젝트 상세 엑셀 — 화면 표와 같은 필터·검색·열 필터·정렬, 1뎁스만 + 배지(숫자 옆 글자·칸 색·메모)."""
    import io
    from flask import send_file
    from perf_export import build_project_detail_xlsx, condition_text
    from perf_export import finance_code_counts
    import finance
    rows = _perf_detail_frame()
    base = ({"year": _perf_current_year, "month": _perf_current_month}
            if _perf_current_month and request_view() == "actual" else None)   # 계획 뷰엔 기준월 없음
    try:
        fin_counts = finance_code_counts(finance.get_df())
    except Exception:
        logger.warning("엑셀 — 재무 이력 건수를 못 세서 [N] 없이 만듦", exc_info=True)
        fin_counts = {}
    data = build_project_detail_xlsx(rows, condition_text(request.args, base), fin_counts)
    name = f"프로젝트상세_{datetime.now():%Y%m%d_%H%M}.xlsx"
    return send_file(io.BytesIO(data), as_attachment=True, download_name=name,
                     mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


# ── 실적현황 파일 자동 반영(관리자 기능 창) — 2026-10-14 ─────────────────────
_PERF_UPLOAD_MAX = 80 * 1024 * 1024


def _reload_plan() -> None:
    """계획 뷰 캐시를 즉시 다시 읽음 — 실패 기록(failed_mtime)·'이미 본 파일' 표시를 지워 같은 파일도 처음부터 다시 시도. 실패해도 예외는 안 던짐"""
    import perf_autoupdate
    st = perf_autoupdate.read_status("plan27")
    if st:
        st.pop("failed_mtime", None)
        perf_autoupdate.write_status(st, "plan27")
    with _plan_cache_lock:
        _plan_cache["seen"] = None
        try:
            load_plan_excel()
        except Exception as e:
            logger.error("계획 시트 다시 시도 실패: %s", e)
            _plan_cache.update(df=pd.DataFrame(), path=None, mtime=None, year=0, sheet=None, loaded=None)


def _update_status_payload() -> dict:
    import perf_autoupdate
    from paths import perf_excel_candidates
    st = perf_autoupdate.read_status()
    st.pop("good", None)   # 서버 경로는 안 내보냄
    st.pop("failed_mtime", None)
    if isinstance(st.get("plan27"), dict):   # 계획 뷰 상태(2026-10-29) — 실적 상태와 같은 모양, 같은 규칙으로 서버 경로 제거
        st["plan27"] = {k: v for k, v in st["plan27"].items() if k not in ("good", "failed_mtime")}
        st["plan27"]["loaded_at"] = _plan_cache["loaded"]
    st["files"] = [os.path.basename(f) for f in perf_excel_candidates()]
    st["loaded_at"] = _perf_last_loaded
    return st


@perf_bp.route("/api/performance/update-status")
@admin_required
def api_perf_update_status():
    if not PERF_AUTO_UPDATE:
        return jsonify({"ok": False, "error": "실적 파일 자동 반영은 지금 꺼져 있습니다"}), 404
    get_perf_df()   # data/에 새 파일이 있으면 여기서 반영 시도
    get_perf_df("plan27")
    return jsonify(_update_status_payload())


@perf_bp.route("/api/performance/update-status/retry", methods=["POST"])
@admin_required
def api_perf_update_retry():
    if not PERF_AUTO_UPDATE:
        return jsonify({"ok": False, "error": "실적 파일 자동 반영은 지금 꺼져 있습니다"}), 404
    """최신 파일 다시 시도 — 실패 기록을 지우고 처음부터(H-chat 일시 오류 등)"""
    import perf_autoupdate
    st = perf_autoupdate.read_status()
    st.pop("failed_mtime", None)
    perf_autoupdate.write_status(st)
    with _perf_cache_lock:
        try:
            load_perf_excel()
        except Exception as e:
            logger.error("실적 다시 시도 실패: %s", e)
    _reload_plan()   # 계획 뷰도 같이(실패 기록 지우고 다시)
    return jsonify(_update_status_payload())


@perf_bp.route("/api/performance/upload", methods=["POST"])
@admin_required
def api_perf_upload():
    if not PERF_AUTO_UPDATE:
        return jsonify({"ok": False, "error": "실적 파일 자동 반영은 지금 꺼져 있습니다"}), 404
    """data/에 실적 파일 넣기(끌어다 놓기·파일 선택) — 사람이 폴더에 직접 넣는 것과 같음. 넣은 뒤 바로 반영 시도"""
    from paths import DATA_DIR
    f = request.files.get("file")
    if not f or not f.filename:
        return jsonify({"ok": False, "error": "파일이 없습니다"}), 400
    name = os.path.basename(f.filename.replace("\\", "/"))
    if not name.lower().endswith((".xlsx", ".xlsb")):
        return jsonify({"ok": False, "error": "엑셀(.xlsx/.xlsb) 파일만 올릴 수 있습니다"}), 400
    if "사업계획 통합관리 파일" not in name:
        return jsonify({"ok": False, "error": "파일 이름에 '사업계획 통합관리 파일'이 있어야 합니다(대시보드가 실적 파일을 찾는 규칙)"}), 400
    dest = os.path.join(DATA_DIR, name)
    data = f.read(_PERF_UPLOAD_MAX + 1)
    if len(data) > _PERF_UPLOAD_MAX:
        return jsonify({"ok": False, "error": "파일이 너무 큽니다(80MB 초과)"}), 413
    notice = ""
    if os.path.exists(dest):
        # 같은 이름 — 내용까지 같으면 할 일 없음(이미 반영된 그 파일), 다르면 기존 파일을 히스토리로 옮기고 교체(2026-10-15)
        with open(dest, "rb") as cur:
            same = cur.read() == data
        if same:
            st = _update_status_payload()
            st["notice"] = "이미 data 폴더에 있는 같은 파일입니다 — 지금 반영된 상태 그대로"
            return jsonify(st)
        hist = os.path.join(DATA_DIR, "경영실적 히스토리")
        os.makedirs(hist, exist_ok=True)
        base, ext = os.path.splitext(name)
        moved = os.path.join(hist, f"{base}_교체전_{datetime.now():%y%m%d_%H%M%S}{ext}")
        try:
            os.replace(dest, moved)
        except OSError:
            return jsonify({"ok": False, "error": "기존 같은 이름 파일이 열려 있어 바꿀 수 없습니다 — Excel에서 닫고 다시 올려 주세요"}), 409
        notice = f"같은 이름의 이전 파일은 '경영실적 히스토리/{os.path.basename(moved)}'로 옮기고 새 파일로 바꿨습니다"
        logger.info("실적 파일 같은 이름 교체 — 이전 파일 보관: %s", moved)
    tmp = dest + ".uploading"
    with open(tmp, "wb") as out:
        out.write(data)
    os.replace(tmp, dest)
    logger.info("실적 파일 업로드: %s (%d bytes)", name, len(data))
    with _perf_cache_lock:
        try:
            load_perf_excel()
        except Exception as e:
            logger.error("업로드 후 반영 실패: %s", e)
    _reload_plan()
    st = _update_status_payload()
    if notice:
        st["notice"] = notice
    return jsonify(st)


@perf_bp.route("/api/performance/fin-mismatch")
@admin_required
def api_perf_fin_mismatch():
    """완료 프로젝트 중 실적현황 ↔ 재무 이력(완료 보고) 매출·직접원가가 다른 것 — 관리자 기능 목록·CSV(2026-10-06).
    프로젝트 상세 표에서 빨간 칸으로 보이는 것과 같은 판정. 필터와 무관하게 전체, 금액은 원 단위."""
    df = get_perf_df()
    if df.empty:
        return jsonify({"data": [], "total": 0})
    rows = _project_rows(df.copy())
    rows = rows[rows["fin_mismatch"].map(bool)]

    def won(v):
        return None if v is None or pd.isna(v) else round(float(v) * 1000)

    out = []
    for _, r in rows.iterrows():
        rec = {k: ("" if pd.isna(r.get(k)) else str(r.get(k)))
               for k in ("project_code", "project_name", "team", "part", "manager", "fin_filename")}
        for key, perf_f in (("revenue", "jun_check_total"), ("cost", "est_cost")):
            pv, fv = won(r.get(perf_f)), won(r.get(f"fin_{perf_f}"))
            rec[f"perf_{key}"] = pv
            rec[f"fin_{key}"]  = fv
            rec[f"{key}_diff"] = (pv - fv) if pv is not None and fv is not None else None
            rec[f"{key}_mismatch"] = perf_f in r["fin_mismatch"]
        out.append(rec)
    # 차이 큰 순(매출·원가 중 큰 쪽 절댓값)
    out.sort(key=lambda x: -max(abs(x["revenue_diff"] or 0) if x["revenue_mismatch"] else 0,
                                 abs(x["cost_diff"] or 0) if x["cost_mismatch"] else 0))
    return jsonify({"data": out, "total": len(out)})


def build_plan_summary():
    """계획 뷰(?view=plan27) 요약 — 27 사업계획 vs 26 연간 추정(시트의 비교 기준). 금액은 전부 천원, 비율은 %.
    실적 요약(api_perf_summary)과 **필드를 공유하지 않는 별도 응답**: base·jun_actual·달성률·누계 같은 실적 필드가 아예 없음(기준월 없음).
      total.y26 / total.y27 : {revenue, cost, overhead, gross, labor, mgmt, profit} — 26 추정 / 27 계획.
        y27은 프로젝트 행 합(팀·파트 필터에 따라 줄어듦), y26의 공통원가·인건비·관리비·경상손익은 프로젝트 행에 없는 값이라
        시트 합계 블록의 '2026년 연간 추정' 열에서 읽음 — 필터 중이거나 못 읽으면 None(화면은 '-'). 매출이익 = 매출 − (직접원가 + 공통원가)
      total.rate[카드 id] : 27 계획 ÷ 26 추정 × 100 (26 값이 없거나 0 이하면 None)
      total.cost_direct 등 : 27 계획 원가 구성(원가 도넛용), by_part·by_team : 파트·팀별 같은 구성 + rev26/rev27/cost26/cost27
      by_part.rev_per_head·profit_per_head·mgmt_per_head : 27 계획 금액 ÷ 2027 인원(관리자 입력 parts27, 실적 보기와 같은 규칙·같은 제외 조건)
      monthly : 1~12월 **계획 분배**(실적 아님)"""
    full = get_perf_df("plan27")
    df = apply_perf_filters(full)
    _year, _sheet, _loaded = _plan_cache["year"], _plan_cache["sheet"], _plan_cache["loaded"]
    if df.empty:
        return jsonify({"view": "plan27", "year": _year, "sheet": _sheet, "loaded_at": _loaded,
                        "total": {}, "by_part": {}, "by_team": {}, "monthly": []})

    rev  = df[df["category"] == "매출"]
    cost = df[df["category"] == "원가"]
    total_of = lambda frame, col: float(frame[col].sum())   # noqa: E731

    y27 = {
        "revenue":  total_of(rev, "jun_check_total"),
        "cost":     total_of(cost, "jun_check_total"),
        "overhead": total_of(rev, "cost_overhead"),
        "labor":    total_of(rev, "cost_labor"),
        "mgmt":     total_of(rev, "cost_mgmt"),
        "profit":   total_of(rev, "operating_profit"),
    }
    y27["gross"] = y27["revenue"] - (y27["cost"] + y27["overhead"])

    # 26 추정 — 매출·직접원가는 프로젝트 행(plan_initial = 시트 Z열), 나머지는 시트 합계 블록(필터 중엔 전사 값뿐이라 None)
    blk = None if len(df) != len(full) else (full.attrs.get("plan_blocks") or {}).get("y26")
    blk = blk or {}
    y26 = {
        "revenue":  total_of(rev, "plan_initial"),
        "cost":     total_of(cost, "plan_initial"),
        "overhead": blk.get("overhead"),
        "labor":    blk.get("labor"),
        "mgmt":     blk.get("mgmt"),
        "profit":   blk.get("profit"),
    }
    y26["gross"] = (y26["revenue"] - (y26["cost"] + y26["overhead"])) if y26["overhead"] is not None else None

    def _vs(v27: float, v26: "float | None") -> "float | None":
        return None if v26 is None else _ratio(v27, v26)

    rate = {
        "revenue":     _vs(y27["revenue"], y26["revenue"]),
        "cost":        _vs(y27["cost"], y26["cost"]),
        "overhead":    _vs(y27["overhead"], y26["overhead"]),
        "grossProfit": _vs(y27["gross"], y26["gross"]),
        "labor":       _vs(y27["labor"], y26["labor"]),
        "mgmt":        _vs(y27["mgmt"], y26["mgmt"]),
        "profit":      _vs(y27["profit"], y26["profit"]),
    }

    total = {
        "y26": y26, "y27": y27, "rate": rate,
        "cost_direct":      total_of(rev, "cost_direct"),
        "cost_labor":       y27["labor"],
        "cost_overhead":    y27["overhead"],
        "cost_mgmt":        y27["mgmt"],
        "operating_profit": y27["profit"],
        # 원가율(%) 두 가지(2026-10-29): cost_rate = 원가(직접+공통) ÷ 매출(원가분석·구성 차트), direct_rate = 직접원가(원가행) ÷ 매출(월별 차트의 원가율)
        "cost_rate":        _ratio(total_of(rev, "cost_direct") + y27["overhead"], y27["revenue"]),
        "direct_rate":      _ratio(y27["cost"], y27["revenue"]),
        "avg_profit_rate":  _weighted_profit_rate(rev),
        "count":            int(len(rev)),
    }

    by_part = {}
    for part_name, rev_grp in rev.groupby("part"):
        cost_grp = cost[cost["part"] == part_name]
        rev27_part = total_of(rev_grp, "jun_check_total")
        by_part[part_name] = {
            "rev26":  total_of(rev_grp, "plan_initial"),
            "rev27":  total_of(rev_grp, "jun_check_total"),
            "cost26": total_of(cost_grp, "plan_initial"),
            "cost27": total_of(cost_grp, "jun_check_total"),
            # 27 계획 매출 ÷ 26 추정 매출 × 100 — 계산은 백엔드(프론트는 표시만). 26이 0 이하면 None
            "rev_rate": _ratio(total_of(rev_grp, "jun_check_total"), total_of(rev_grp, "plan_initial")),
            "cost_direct":      total_of(rev_grp, "cost_direct"),
            "cost_labor":       total_of(rev_grp, "cost_labor"),
            "cost_overhead":    total_of(rev_grp, "cost_overhead"),
            "cost_mgmt":        total_of(rev_grp, "cost_mgmt"),
            "operating_profit": total_of(rev_grp, "operating_profit"),
            # 27 계획 매출 대비 구성 비율(%) — 구성 막대 칸 수치 옆에 표시(2026-10-29). 매출이 0 이하면 None
            "comp_rate": {
                "direct":   _ratio(total_of(rev_grp, "cost_direct"), rev27_part),
                "labor":    _ratio(total_of(rev_grp, "cost_labor"), rev27_part),
                "overhead": _ratio(total_of(rev_grp, "cost_overhead"), rev27_part),
                "mgmt":     _ratio(total_of(rev_grp, "cost_mgmt"), rev27_part),
                "profit":   _ratio(total_of(rev_grp, "operating_profit"), rev27_part),
            },
            # 원가율 = 원가(직접+공통) ÷ 매출 × 100 — 실적 보기 원가분석과 같은 정의(2026-10-29). 매출이 0 이하면 None
            "cost_rate": _ratio(total_of(rev_grp, "cost_direct") + total_of(rev_grp, "cost_overhead"), rev27_part),
            "avg_profit_rate":  _weighted_profit_rate(rev_grp),
            "count":            int(len(rev_grp)),
        }

    # 파트별 인당 값(2026-10-29 요청) — 실적 보기와 **같은 규칙·같은 함수**이되 인원은 **2027 인원**(data/headcount.json의 parts27, 관리자 > 파트별 인원 >
    # 2027에서 따로 입력 — 처음엔 2026 인원을 빌려 썼다가 연도별로 나눠 달라는 요청으로 분리). 나누는 금액은 27 계획. 인원이 없거나(None),
    # 팀 필터로 행이 잘린 상태에서 여러 팀에 걸친 파트(K뉴딜TF)는 인당 값 None + headcount_partial(파트 전체 인원 ÷ 팀 몫 금액이 되어 틀림)
    _hc = headcount.read_headcount()["parts27"]
    _team_cut = bool(request.args.get("team"))
    _full_rev = full[full["category"] == "매출"]
    _multi_team = set(_full_rev.groupby("part")["team"].nunique().loc[lambda n: n > 1].index) if _team_cut else set()
    for part_name, st in by_part.items():
        hc = _hc.get(strip_part_prefix(part_name))
        partial = part_name in _multi_team
        ph = headcount.per_head_fields(
            {"jun_check_total": st["rev27"], "operating_profit": st["operating_profit"], "cost_mgmt": st["cost_mgmt"]},
            None if partial else hc)
        st["headcount"] = hc
        st["headcount_partial"] = partial
        st["rev_per_head"] = ph["rev_per_head_est"]     # 이름의 est는 실적 보기 기준 — 여기선 27 계획 금액 ÷ 인원
        st["profit_per_head"] = ph["profit_per_head"]
        st["mgmt_per_head"] = ph["mgmt_per_head"]

    by_team = {
        team_name: {
            "cost_direct":      total_of(g, "cost_direct"),
            "cost_labor":       total_of(g, "cost_labor"),
            "cost_overhead":    total_of(g, "cost_overhead"),
            "cost_mgmt":        total_of(g, "cost_mgmt"),
            "operating_profit": total_of(g, "operating_profit"),
            "cost_rate":        _ratio(total_of(g, "cost_direct") + total_of(g, "cost_overhead"), total_of(g, "jun_check_total")),
        }
        for team_name, g in rev.dropna(subset=["team"]).groupby("team")
    }

    monthly = [
        {"month": f"{m}월", "revenue": total_of(rev, f"chk_m{m:02d}"), "cost": total_of(cost, f"chk_m{m:02d}")}
        for m in range(1, 13)
    ]
    return jsonify({"view": "plan27", "year": _year, "sheet": _sheet, "loaded_at": _loaded,
                    "total": total, "by_part": by_part, "by_team": by_team, "monthly": monthly})


@perf_bp.route("/api/performance/views")
def api_perf_views():
    """화면 전환(2026 실적 / 2027 계획)이 쓸 수 있는 뷰 목록 — 계획 시트가 없으면 plan27.available=False(칩을 숨김)"""
    actual = get_perf_df()
    plan = get_perf_df("plan27")
    import perf_autoupdate
    return jsonify({
        "actual": {"available": not actual.empty,
                   # 전환 칩 이름 — 실제 시트명("2026년 (9월 집계)")을 그대로 보여 두 시트가 한눈에 구분되게(2026-10-29)
                   "sheet": perf_autoupdate.read_status().get("serving_sheet"),
                   "base": {"year": _perf_current_year, "month": _perf_current_month} if _perf_current_month else None},
        "plan27": {"available": not plan.empty, "sheet": _plan_cache["sheet"], "year": _plan_cache["year"] or None},
    })


@perf_bp.route("/api/performance/summary")
def api_perf_summary():
    if request_view() == "plan27":
        return build_plan_summary()
    df = apply_perf_filters(get_perf_df())
    if df.empty:
        return jsonify({"total": {}, "by_part": {}, "by_progress": {}, "monthly": []})

    rev  = df[df["category"] == "매출"]
    cost = df[df["category"] == "원가"]

    _plan_rev  = float(rev["plan_initial"].sum())
    _plan_cost = float(cost["plan_initial"].sum())
    _est_rev   = float(rev["jun_check_total"].sum())
    _est_cost  = float(cost["jun_check_total"].sum())
    _acc_rev   = float(rev["jun_actual"].sum())
    _acc_cost  = float(cost["jun_check_total"].sum())

    # 계획 칸 공통원가 — 시트 합계 블록의 사업계획 기준 값(전체 보기일 때만 유효). 팀·파트로 걸렀거나 못 읽으면
    # 예전처럼 추정 공통원가(매출행 BD)로 대체하고 plan_overhead_source="estimate"로 알림(프론트가 계획 글자를 빨갛게)
    _full = get_perf_df()
    _blk  = _full.attrs.get("plan_overhead") if len(df) == len(_full) else None
    _est_overhead  = float(rev["cost_overhead"].sum())
    _plan_overhead = _blk if _blk is not None else _est_overhead
    # 계획 관리비·경상손익(2026-10-27) — 같은 합계 블록. 팀·파트로 걸렀거나 못 읽으면 None(프론트는 계획 칸을 '-'로).
    # 공통원가와 달리 대체할 값이 없음 — 추정으로 채우면 계획=추정으로 보여 오해
    _extra = _full.attrs.get("plan_block_extra") if len(df) == len(_full) else None

    # 카드별 "계획 대비 추정" 비율(%) = 추정 ÷ 계획 × 100 (2026-10-27, 카드의 추정 값 위에 표시). 계획이 없거나(None) 0 이하면 None.
    # 키 = 프론트 카드 id. 계획 칸 값은 위 카드 정의와 같은 것(plan_gross·plan_overhead·시트 블록의 관리비·인건비·경상손익)
    _est_labor  = float(rev["cost_labor"].sum())
    _est_mgmt   = float(rev["cost_mgmt"].sum())
    _est_profit = float(rev["operating_profit"].sum())
    _plan_gross = _plan_rev - (_plan_cost + _plan_overhead)
    _est_gross  = _est_rev - (_est_cost + _est_overhead)

    def _vs_plan(est: float, plan: "float | None") -> "float | None":
        return None if plan is None else _ratio(est, plan)

    est_plan_rate = {
        "revenue":     _vs_plan(_est_rev, _plan_rev),
        "cost":        _vs_plan(_est_cost, _plan_cost),
        # 필터 중엔 계획 공통원가가 추정값으로 대체돼(_blk None) 100%가 나오므로 비움
        "overhead":    _vs_plan(_est_overhead, _plan_overhead if _blk is not None else None),
        "grossProfit": _vs_plan(_est_gross, _plan_gross),
        "labor":       _vs_plan(_est_labor, _extra["labor"] if _extra else None),
        "mgmt":        _vs_plan(_est_mgmt, _extra["mgmt"] if _extra else None),
        "profit":      _vs_plan(_est_profit, _extra["profit"] if _extra else None),
    }

    total = {
        "plan_initial":     _plan_rev,
        "plan_cost":        _plan_cost,
        "actual_2025":      float(rev["actual_2025"].sum()),
        "jun_actual":       _acc_rev,
        "jun_cost_actual":  float(cost["jun_actual"].sum()),
        "jun_cost":         _acc_cost,
        "jun_check_total":  _est_rev,
        "operating_profit": float(rev["operating_profit"].sum()),
        "profit_gross":     float(rev["profit_gross"].sum()),
        # 누계(1~기준월) 기준 재구성값 — 위 operating_profit/profit_gross는 연간 기준
        "acc_operating_profit": float(rev["acc_operating_profit"].sum()),
        "acc_profit_gross":     float(rev["acc_profit_gross"].sum()),
        "cost_direct":      float(rev["cost_direct"].sum()),
        "cost_labor":       float(rev["cost_labor"].sum()),
        "cost_overhead":    float(rev["cost_overhead"].sum()),
        "cost_mgmt":        float(rev["cost_mgmt"].sum()),
        "avg_profit_rate":  _weighted_profit_rate(rev),
        "count":            int(len(rev)),
        # ── 파생값(프론트 계산 이전) ──────────────────────────────
        # '당해 연도 매출이익(계획/추정)' 카드 = 매출 − (직접원가 + 공통원가) — 2026-10-23 정의 변경(예전엔 매출 − 직접원가).
        # 추정 칸은 매출행 BD(연간 추정) 공통원가, 계획 칸은 시트 합계 블록의 사업계획 기준 공통원가(plan_overhead, 2026-10-23).
        # 블록을 못 읽거나 팀·파트 필터 중이면 계획 칸도 추정 공통원가로 대체(plan_overhead_source="estimate").
        # ⚠️ 프로젝트 상세 표의 '매출 이익'(est_gross, 매출 − 직접원가)·경상손익 검증식(BA = BH − BB)은 그대로
        "plan_gross":       _plan_gross,
        "est_gross":        _est_gross,
        "plan_overhead":    _plan_overhead,
        "plan_overhead_source": "sheet" if _blk is not None else "estimate",
        # 계획 관리비·경상손익(천원) — 시트 합계 블록의 사업계획 기준. 필터 중·못 읽음 = None
        "plan_mgmt":             _extra["mgmt"]   if _extra else None,
        "plan_operating_profit": _extra["profit"] if _extra else None,
        # 계획 인건비(천원, 같은 블록의 '인건비' 줄 — 9월 집계 925행 W열 5,361,140 = 53.61억). 추정은 cost_labor(매출행 합)
        "plan_labor":            _extra["labor"]  if _extra else None,
        # 카드별 계획 대비 추정(%) — 카드 id → 값(없으면 None)
        "est_plan_rate":         est_plan_rate,
        # '당해 연도 추정 관리비' 카드(2026-10-23) 보조값 — 관리비(매출행 BE, 연간 추정 기준) ÷ 연간 추정 매출 × 100
        "est_mgmt_rate":    _ratio(float(rev["cost_mgmt"].sum()), _est_rev),
        # 계획 대비 누계 진행률 = 누계매출 ÷ 계획매출 × 100
        "achieve_rate":     _ratio(_acc_rev, _plan_rev),
        # 추정 대비 누계 진행률 = 누계매출 ÷ 연간 추정매출 × 100 — 누계 실적 카드 옆 표시(2026-10-02)
        "est_progress_rate": _ratio(_acc_rev, _est_rev),
        # 원가도 같은 방식 — 누계원가(원가행 1~기준월) ÷ 연간 추정원가(원가행 BH) × 100
        "est_cost_progress_rate": _ratio(float(cost["jun_actual"].sum()), _est_cost),
        # 전월대비 diff(천원) — monthly 계산 후 아래에서 채움
        "mom_revenue":      None,
        "mom_gross":        None,
    }

    by_part = {}
    for part_name, rev_grp in rev.groupby("part"):
        cost_grp = cost[cost["part"] == part_name]
        by_part[part_name] = {
            "plan_initial":     float(rev_grp["plan_initial"].sum()),
            "plan_cost":        float(cost_grp["plan_initial"].sum()),
            "jun_actual":       float(rev_grp["jun_actual"].sum()),
            "jun_cost":         float(cost_grp["jun_actual"].sum()),
            "jun_check_total":  float(rev_grp["jun_check_total"].sum()),
            # 연간 추정 원가 — 위 jun_cost(누계 원가)와 짝이 아니라 jun_check_total(연간 추정 매출)의 짝.
            # total 쪽은 같은 값을 "jun_cost"라는 이름으로 쓰고 있어 이름이 어긋나므로(누계=jun_cost_actual)
            # by_part에서는 혼동을 피하려 별도 키로 추가한다.
            "jun_cost_check":   float(cost_grp["jun_check_total"].sum()),
            "operating_profit": float(rev_grp["operating_profit"].sum()),
            "avg_profit_rate":  _weighted_profit_rate(rev_grp),
            # 누계(1~기준월) 기준 — 누계매출/누계원가와 같은 기간이라 나란히 비교 가능
            "acc_operating_profit": float(rev_grp["acc_operating_profit"].sum()),
            "acc_profit_rate":      _acc_profit_rate(rev_grp),
            "count":            int(len(rev_grp)),
            # 파생값(프론트 계산 이전) — 누계 원가율 · 계획 대비 진행률
            "cost_rate":     _ratio(float(cost_grp["jun_actual"].sum()), float(rev_grp["jun_actual"].sum())),
            "achieve_rate":  _ratio(float(rev_grp["jun_actual"].sum()), float(rev_grp["plan_initial"].sum())) or 0.0,
            # 추정 대비 누계 진행률 — 파트별 매출 진행 현황 막대(2026-10-02: 분모를 계획 → 연간 추정으로)
            "est_progress_rate": _ratio(float(rev_grp["jun_actual"].sum()), float(rev_grp["jun_check_total"].sum())) or 0.0,
            # 원가 구성 (도넛 차트용)
            "cost_direct":   float(rev_grp["cost_direct"].sum()),
            "cost_labor":    float(rev_grp["cost_labor"].sum()),
            "cost_overhead": float(rev_grp["cost_overhead"].sum()),
            "cost_mgmt":     float(rev_grp["cost_mgmt"].sum()),
        }

    # 파트별 인원(관리자 수기, data/headcount.json) → 인당 값(2026-10-23). 인원은 파트 전체 기준이라, 팀 필터로 행이 잘린
    # 상태에서 여러 팀에 걸친 파트(K뉴딜TF)는 팀 몫 금액 ÷ 파트 전체 인원이 되어 틀림 → 인당 값 None + headcount_partial
    _hc_all = headcount.read_headcount()
    _hc, _hc_plan = _hc_all["parts"], _hc_all["plan_parts"]
    _team_cut = bool(request.args.get("team"))
    _full_rev = _full[_full["category"] == "매출"]
    _multi_team = set(_full_rev.groupby("part")["team"].nunique().loc[lambda n: n > 1].index) if _team_cut else set()
    for part_name, st in by_part.items():
        hc = _hc.get(strip_part_prefix(part_name))
        hc_plan = _hc_plan.get(strip_part_prefix(part_name))
        partial = part_name in _multi_team
        st.update(headcount.per_head_fields(st, None if partial else hc, None if partial else hc_plan))
        st["headcount"] = hc
        # st["plan_headcount"] = hc_plan   # 계획 인원 주석 처리(2026-10-27)
        st["headcount_partial"] = partial

    # 팀별 원가 구성·경상손익 — 도넛 '팀' 보기용, 행의 팀 칸 기준(2026-10-21). 예전엔 프론트가 "팀 = 소속 파트 합"으로 더해
    # 팀이 여러 개인 파트(K뉴딜TF)가 세 팀에 통째로 들어갔음
    by_team = {
        team_name: {
            "cost_direct":      float(g["cost_direct"].sum()),
            "cost_labor":       float(g["cost_labor"].sum()),
            "cost_overhead":    float(g["cost_overhead"].sum()),
            "cost_mgmt":        float(g["cost_mgmt"].sum()),
            "operating_profit": float(g["operating_profit"].sum()),
        }
        for team_name, g in rev.dropna(subset=["team"]).groupby("team")
    }

    by_progress_raw = {}
    for prog_name, rev_grp in rev.groupby("progress"):
        cost_grp = cost[cost["progress"] == prog_name]
        by_progress_raw[prog_name] = {
            "revenue": float(rev_grp["jun_actual"].sum()),
            "cost":    float(cost_grp["jun_actual"].sum()),
            "profit":  float(rev_grp["operating_profit"].sum()),
            "count":   int(len(rev_grp)),
        }
    known_prog   = [p for p in _PROGRESS_PRIORITY if p in by_progress_raw]
    unknown_prog = sorted(k for k in by_progress_raw if k not in _PROGRESS_PRIORITY)
    by_progress  = {p: by_progress_raw[p] for p in known_prog + unknown_prog}

    MONTH_COLS = [
        ("chk_m01","1월"), ("chk_m02","2월"), ("chk_m03","3월"),
        ("chk_m04","4월"), ("chk_m05","5월"), ("chk_m06","6월"),
        ("chk_m07","7월"), ("chk_m08","8월"), ("chk_m09","9월"),
        ("chk_m10","10월"),("chk_m11","11월"),("chk_m12","12월"),
    ]
    monthly = [
        {
            "month":   label,
            "revenue": float(rev[col].sum()),
            "cost":    float(cost[col].sum()) if col in cost.columns else 0.0,
        }
        for col, label in MONTH_COLS
        if col in rev.columns
    ]

    # 전월대비(당월 vs 전월) — monthly[] 는 chk_m01~12 집계 (1-based 월 → 0-based 인덱스)
    m = _perf_current_month
    if 2 <= m <= len(monthly):
        curr, prev = monthly[m - 1], monthly[m - 2]
        total["mom_revenue"] = curr["revenue"] - prev["revenue"]
        total["mom_gross"]   = (curr["revenue"] - curr["cost"]) - (prev["revenue"] - prev["cost"])

    # base — 실제로 읽은 시트의 기준 연·월(예: "2026년 (8월 집계)" → 2026, 8). 화면의 "1~N월 실적"·월별 차트의
    # 실적/추정 경계를 이걸로 맞춤. 예전엔 프론트가 "오늘 - 1개월"로 짐작해서, 10월 1일이 되자 9월 시트가 아직 없는데도
    # 9월을 실적으로 칠했음(2026-10-01)
    base = {"year": _perf_current_year, "month": _perf_current_month} if _perf_current_month else None
    return jsonify({"total": total, "by_part": by_part, "by_team": by_team, "by_progress": by_progress, "monthly": monthly,
                    "loaded_at": _perf_last_loaded, "base": base})


@perf_bp.route("/api/performance/insights")
def api_perf_insights():
    if request_view() != "actual":
        return jsonify({"ok": False, "error": "계획 보기는 인사이트를 지원하지 않습니다(달성률·누계 기반)"}), 400
    df = apply_perf_filters(get_perf_df())
    if df.empty:
        return jsonify({"worst": [], "risk": [], "comments": []})

    rev = df[df["category"] == "매출"].copy()
    if rev.empty:
        return jsonify({"worst": [], "risk": [], "comments": []})

    rev["achieve_rate"] = np.where(
        rev["plan_initial"] > 0,
        (rev["jun_actual"] / rev["plan_initial"] * 100).round(1),
        np.nan,
    )
    rev_coded      = rev[rev["project_code"].apply(is_ranked_valid_code)]
    valid_achieve  = rev_coded.dropna(subset=["achieve_rate"])

    worst = (
        valid_achieve[valid_achieve["achieve_rate"] < 100]
        .nsmallest(10, "achieve_rate")
        [["project_code", "part", "project_name", "plan_initial", "jun_actual", "achieve_rate"]]
        .to_dict(orient="records")
    )

    risk_pool = rev_coded[(rev_coded["operating_profit"] < 0) | (rev_coded["profit_rate"] < 5)].copy()
    risk_pool["_is_loss"] = (risk_pool["operating_profit"] < 0).astype(int)
    risk = (
        risk_pool
        .sort_values(["_is_loss", "profit_rate"], ascending=[False, True])
        .head(10)
        .drop(columns=["_is_loss"])
        [["project_code", "part", "project_name", "operating_profit", "profit_rate"]]
        .to_dict(orient="records")
    )

    comments = []

    loss_rows = rev_coded[rev_coded["operating_profit"] < 0].nsmallest(3, "operating_profit")
    for _, lrow in loss_rows.iterrows():
        comments.append({
            "type": "warning", "icon": "",
            "project_code": str(lrow["project_code"]),
            "project_name": str(lrow["project_name"]),
            "text": f"손실 {_bil_perf(lrow['operating_profit'])} — 확인 필요",
        })

    worst_rows = valid_achieve[valid_achieve["achieve_rate"] < 70].nsmallest(2, "achieve_rate")
    for _, wrow in worst_rows.iterrows():
        comments.append({
            "type": "warning", "icon": "",
            "project_code": str(wrow["project_code"]),
            "project_name": str(wrow["project_name"]),
            "text": f"({html_escape(str(wrow['part']))}) 달성률 {wrow['achieve_rate']}% — 목표 대비 부진",
        })

    part_stats = (
        valid_achieve.groupby("part")
        .agg(avg_achieve=("achieve_rate", "mean"))
        .reset_index()
    )
    if len(part_stats) > 1:
        best_row  = part_stats.loc[part_stats["avg_achieve"].idxmax()]
        worst_row = part_stats.loc[part_stats["avg_achieve"].idxmin()]
        if best_row["part"] != worst_row["part"]:
            gap = round(best_row["avg_achieve"] - worst_row["avg_achieve"], 1)
            comments.append({
                "type": "warning", "icon": "",
                "text": f"<b>{html_escape(str(worst_row['part']))}</b> 평균 달성률 {round(worst_row['avg_achieve'], 1)}% — "
                        f"{html_escape(str(best_row['part']))} 대비 -{gap}%p",
            })

    total_plan   = rev["plan_initial"].sum()
    total_actual = rev["jun_actual"].sum()
    if total_plan > 0:
        total_achieve = round(total_actual / total_plan * 100, 1)
        comments.append({
            "type": "info", "icon": "",
            "text": f"전체 달성률 {total_achieve}% (계획 대비, 필터 기준)",
        })

    return jsonify({"worst": worst, "risk": risk, "comments": comments})


# 차트별 드릴다운 매핑 — series 0/1이 각각 어떤 행(category)의 어떤 엑셀 필드를 합산하는지.
# api_perf_summary의 monthly / by_part 계산과 정확히 같은 필드를 써야 total이 막대값과 일치한다.
_PERF_BREAKDOWN = {
    "monthly": {
        "dim": "month",
        "agg_desc": "선택한 월의 값을 프로젝트별로 그대로 더한 값입니다 (평균·가중치 없음). 기준월 이후는 추정치입니다.",
        "series": [
            {"label": "매출", "category": "매출", "field": "chk_m{mm}",
             "field_desc": "매출행의 월별 실적 점검 열(엑셀 BI~BT = 1~12월)"},
            {"label": "원가", "category": "원가", "field": "chk_m{mm}",
             "field_desc": "원가행의 월별 실적 점검 열(엑셀 BI~BT = 1~12월)"},
            # 2~4 = 확대 모달 월별 표의 손익·누계 컬럼 전용(차트 막대는 0/1만 씀, 2026-09-28).
            # signs: 카테고리별 부호(매출 +, 원가 −) — 둘 이상이면 프로젝트별로 묶어 순액 표시
            # cumulative: 1월 ~ 선택 월까지 합산
            {"label": "손익", "category": "매출", "signs": {"매출": 1, "원가": -1}, "field": "chk_m{mm}",
             "field_desc": "매출행 − 원가행의 해당 월 실적 점검 열(엑셀 BI~BT)"},
            {"label": "누계매출", "category": "매출", "cumulative": True, "field": "chk_m{mm}",
             "field_desc": "매출행의 1월 ~ 해당 월 실적 점검 열 합(엑셀 BI~BT)"},
            {"label": "누계손익", "category": "매출", "signs": {"매출": 1, "원가": -1}, "cumulative": True,
             "field": "chk_m{mm}",
             "field_desc": "(매출행 − 원가행)의 1월 ~ 해당 월 실적 점검 열 합(엑셀 BI~BT)"},
        ],
    },
    "planVsActual": {
        "dim": "part",
        "agg_desc": "파트별로 프로젝트 값을 단순 합산한 것입니다 (평균·가중치 없음).",
        # pair — 어느 막대를 클릭해도 이 파트의 계획·실적을 프로젝트별로 나란히 비교해서 보여줌
        "pair": True,
        "series": [
            {"label": "계획", "role": "plan", "category": "매출", "field": "plan_initial",
             "field_desc": "매출행의 '최초 사업계획' 금액 (엑셀 V열)"},
            {"label": "추정 실적", "role": "actual", "category": "매출", "field": "jun_check_total",
             "field_desc": "매출행의 '연간 점검 합계' (엑셀 BH열 = 1~12월 합, 미래월 추정 포함)"},
        ],
    },
    "profitRate": {
        "dim": "part",
        "agg_desc": "파트별 단순 합산입니다. 이 화면 값은 매출·원가 '원금액'이며, 손익률(경상손익÷매출)은 여기 없습니다.",
        "series": [
            {"label": "매출", "category": "매출", "field": "jun_check_total",
             "field_desc": "매출행의 연간 점검 합계 (엑셀 BH열)"},
            {"label": "직접원가", "category": "원가", "field": "jun_check_total",
             "field_desc": "원가행의 연간 점검 합계 (엑셀 BH열) — 매출행 '직접원가(BB열)'와 1:1로 대응"},
            # 원가 막대 위층(2026-10-20) — 손익의 공통원가(매출행 BD열, 연간 기준)
            {"label": "공통원가", "category": "매출", "field": "cost_overhead",
             "field_desc": "매출행의 공통원가 (엑셀 BD열, 연간 기준)"},
        ],
    },
    "partAchievement": {
        "dim": "part",
        "agg_desc": "선택 파트의 프로젝트별 누계 실적(1~기준월)을 더한 값입니다. 진행률 = 이 합계 ÷ 연간 추정 합계 × 100.",
        "pair": True,
        "series": [
            {"label": "누계 실적", "role": "actual", "category": "매출", "field": "jun_actual",
             "field_desc": "매출행의 경과월 누계 실적 (chk_m01~기준월 재합산값)"},
            # 분모를 연간 계획 → 연간 추정으로(2026-10-02). role "plan"은 비교표의 분모 칸이라는 뜻
            {"label": "연간 추정", "role": "plan", "category": "매출", "field": "jun_check_total",
             "field_desc": "매출행의 연간 추정 합계 (1~12월, 미래월 추정 포함)"},
        ],
    },
    "costBreakdown": {
        "dim": "none",   # 파트·월 구분 없이 전체 매출행 대상
        "agg_desc": "전체 매출행의 해당 원가 항목을 그대로 더한 값입니다. 도넛은 이 합계들의 구성비(금액 가중).",
        "series": [
            {"label": "직접원가", "category": "매출", "field": "cost_direct",
             "field_desc": "매출행의 직접원가 (엑셀 BB열)"},
            {"label": "인건비", "category": "매출", "field": "cost_labor",
             "field_desc": "매출행의 직접인건비 (엑셀 BC열)"},
            {"label": "공통원가", "category": "매출", "field": "cost_overhead",
             "field_desc": "매출행의 공통원가 (엑셀 BD열)"},
            {"label": "관리비", "category": "매출", "field": "cost_mgmt",
             "field_desc": "매출행의 관리비 (엑셀 BE열)"},
            {"label": "경상손익", "category": "매출", "field": "operating_profit",
             "field_desc": "매출행의 경상손익 (엑셀 BF열) — 매출 − 모든 원가"},
        ],
    },
}

# 파생 값이 어떻게 만들어지는지 — 모달 '용어' 영역에 항상 표시 (docs/session-log 검증 결과 기준)
_PERF_CALC_GLOSSARY = [
    {"term": "매출이익", "formula": "매출(BH) − 직접원가(BB)", "note": "엑셀 BA열. 인건비·공통원가·관리비는 아직 안 뺀 값."},
    {"term": "경상손익", "formula": "매출이익(BA) − 직접인건비(BC) − 공통원가(BD) − 관리비(BE)", "note": "엑셀 BF열. 실제 총원가는 직접원가만이 아님."},
    {"term": "손익률",   "formula": "경상손익(BF) ÷ 매출(BH) × 100", "note": "엑셀 BG열. 파트 집계는 합계÷합계(금액 가중)."},
    {"term": "연간 점검 합계(BH)", "formula": "1월(BI) + … + 12월(BT)", "note": "미래 월은 추정치가 포함된 연간 전망값."},
]


def _perf_breakdown_series(df, spec, s, key):
    """단일 시리즈(s)를 프로젝트별로 합산 — (rows_out, raw_sum, key_label) 또는 실패 시 (None, None, message)."""
    fields = [s["field"]]
    signs  = s.get("signs") or {s["category"]: 1}

    if spec["dim"] == "month":
        m = re.match(r"(\d+)", key)
        if not m:
            return None, None, f"월 형식 오류: {key}"
        mm     = int(m.group(1))
        months = range(1, mm + 1) if s.get("cumulative") else [mm]
        fields = [s["field"].format(mm=f"{k:02d}") for k in months]
        sub    = df[df["category"].isin(signs.keys())]
        key_label = key
    elif spec["dim"] == "part":
        stripped  = df["part"].astype(str).apply(lambda p: PART_PREFIX_RE.sub("", p).strip())
        sub       = df[(df["category"] == s["category"]) & (stripped == key)]
        key_label = key
    else:  # none — 전체 대상
        sub       = df[df["category"] == s["category"]]
        key_label = s["label"]

    missing = [f for f in fields if f not in sub.columns]
    if missing:
        return None, None, f"'{missing[0]}' 컬럼을 찾을 수 없습니다."

    # 부호가 섞이면(손익 = 매출 − 원가) 같은 프로젝트의 매출행·원가행을 한 줄 순액으로 묶음 —
    # 안 묶으면 한 프로젝트가 +/− 두 줄로 쪼개져 읽기 어려움. 단일 카테고리는 기존대로 행 단위
    merge  = len(signs) > 1
    raw_sum = 0.0
    acc: dict = {}
    for _, r in sub.iterrows():
        v = sum(float(r.get(f)) for f in fields if pd.notna(r.get(f))) * signs[r["category"]]
        if v == 0:
            continue
        raw_sum += v
        info = {
            "project_code": str(r.get("project_code", "")).strip(),
            "project_name": str(r.get("project_name", "")).strip(),
            "part":  str(r.get("part", "")).strip(),
            "team":  str(r.get("team", "")).strip(),
        }
        k = (info["project_code"], info["project_name"], info["team"]) if merge else len(acc)   # 팀까지 — 같은 이름 K뉴딜이 팀마다 따로
        if k in acc:
            acc[k]["raw"] += v
        else:
            acc[k] = {**info, "raw": v}
    rows_out = [
        {**{kk: vv for kk, vv in a.items() if kk != "raw"}, "value": round(a["raw"] / 100_000, 1)}   # 천원 → 억
        for a in acc.values() if a["raw"] != 0   # 매출·원가가 정확히 상쇄된 프로젝트는 제외
    ]
    rows_out.sort(key=lambda x: x["value"], reverse=True)
    return rows_out, raw_sum, key_label


def _perf_breakdown_compare(df, spec, key):
    """pair=True인 차트 전용 — role="plan"/"actual" 두 시리즈를 프로젝트 단위로 합쳐
    계획·실적·달성률을 한 행에 담는다. 클릭한 막대가 계획이든 실적이든 항상 둘 다 보여주기 위함
    (2026-09-28, "계획 vs 실적 모달인데 정작 비교가 없다"는 피드백 반영)."""
    try:
        s_plan   = next(s for s in spec["series"] if s.get("role") == "plan")
        s_actual = next(s for s in spec["series"] if s.get("role") == "actual")
    except StopIteration:
        return None

    plan_rows, plan_sum, _   = _perf_breakdown_series(df, spec, s_plan, key)
    actual_rows, actual_sum, _ = _perf_breakdown_series(df, spec, s_actual, key)
    if plan_rows is None or actual_rows is None:
        return None

    by_code: dict = {}
    for role, rows in (("plan", plan_rows), ("actual", actual_rows)):
        for r in rows:
            k = (r["project_code"], r["project_name"], r.get("team", ""))
            entry = by_code.setdefault(k, {
                "project_code": r["project_code"], "project_name": r["project_name"],
                "part": r["part"], "team": r["team"], "plan": 0.0, "actual": 0.0,
            })
            entry[role] = r["value"]

    rows_out = list(by_code.values())
    for r in rows_out:
        r["rate"] = round(r["actual"] / r["plan"] * 100, 1) if r["plan"] else None
    # 달성률 낮은(미달) 프로젝트가 위로 — 분모 0(비교 불가)은 맨 아래
    rows_out.sort(key=lambda r: (r["rate"] is None, r["rate"] if r["rate"] is not None else 0))

    plan_total   = round(plan_sum / 100_000, 1)
    actual_total = round(actual_sum / 100_000, 1)
    return {
        "plan_label":       s_plan["label"],
        "actual_label":     s_actual["label"],
        "plan_field_desc":  s_plan.get("field_desc", ""),
        "actual_field_desc": s_actual.get("field_desc", ""),
        "rows":             rows_out,
        "plan_total":       plan_total,
        "actual_total":     actual_total,
        "rate":             round(actual_total / plan_total * 100, 1) if plan_total else None,
    }


@perf_bp.route("/api/performance/summary/breakdown")
def api_perf_summary_breakdown():
    """
    실적현황 차트가 '어떤 프로젝트 행들을 합산해서' 나온 값인지 드릴다운.
    - chart:  monthly | planVsActual | profitRate | costBreakdown | partAchievement
    - series: 데이터셋/세그먼트 순서 (costBreakdown은 0~4: 직접원가·인건비·공통원가·관리비·경상손익)
    - key:    월 라벨("3월") 또는 파트명(접두 원문자 제거된 표시명). costBreakdown은 불필요
    필터(part/team)는 summary와 동일하게 적용. 반환 total(억)이 막대·세그먼트 값과 일치한다.
    pair=True인 차트(planVsActual·partAchievement)는 클릭한 시리즈와 무관하게 `compare`에
    계획·실적을 프로젝트별로 나란히 담아 함께 반환한다.
    """
    if request_view() != "actual":
        return jsonify({"available": False, "message": "계획 보기는 막대별 산출 근거를 아직 지원하지 않습니다."})
    df = apply_perf_filters(get_perf_df())
    if df.empty:
        return jsonify({"available": False, "message": "표시할 데이터가 없습니다."})

    chart = request.args.get("chart", "").strip()
    key   = request.args.get("key", "").strip()
    try:
        series_idx = int(request.args.get("series", 0))
    except (ValueError, TypeError):
        series_idx = 0

    spec = _PERF_BREAKDOWN.get(chart)
    if not spec or not (0 <= series_idx < len(spec["series"])):
        return jsonify({"available": False, "message": f"알 수 없는 차트/시리즈: {chart} / {series_idx}"})

    s = spec["series"][series_idx]
    rows_out, raw_sum, key_label = _perf_breakdown_series(df, spec, s, key)
    if rows_out is None:
        return jsonify({"available": False, "message": key_label})

    payload = {
        "available":    True,
        "chart":        chart,
        "series_label": s["label"],
        "dim":          spec["dim"],
        "key":          key_label,
        "field_desc":   s.get("field_desc", ""),
        "agg_desc":     spec.get("agg_desc", ""),
        "glossary":     _PERF_CALC_GLOSSARY,
        "rows":         rows_out,
        "count":        len(rows_out),
        "total":        round(raw_sum / 100_000, 1),   # raw 합계 후 변환 — 막대값(toEokNum)과 동일 기준
        "unit":         "억",
    }

    if spec.get("pair"):
        compare = _perf_breakdown_compare(df, spec, key)
        if compare is not None:
            payload["compare"] = compare

    return jsonify(payload)


@perf_bp.route("/api/performance/reload", methods=["POST"])
def api_perf_reload():
    try:
        with _perf_cache_lock:
            load_perf_excel()
            count     = len(_perf_cached_df)
            loaded_at = _perf_last_loaded
        _reload_plan()   # 계획 뷰도 같이 다시 읽음(계획 시트가 없는 파일이면 조용히 비움)
        return jsonify({"ok": True, "loaded_at": loaded_at, "count": count})
    except Exception as e:
        logger.error("api_perf_reload 실패: %s", e)
        return jsonify({"ok": False, "error": str(e)}), 500
