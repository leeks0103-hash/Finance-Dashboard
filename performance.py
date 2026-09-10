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

from shared import is_ranked_valid_code

load_dotenv()

logger = logging.getLogger(__name__)

perf_bp = Blueprint("performance", __name__)

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DATA_DIR  = os.path.join(_BASE_DIR, "data")

# 실적 엑셀 경로는 paths.py 한 곳에서 관리 (.env: PERF_EXCEL_PATH, 없으면 data/ 최신 자동)
from paths import resolve_perf_excel

PERF_EXCEL_PATH = resolve_perf_excel()

_PERF_SHEET_RE = re.compile(r"^(\d{4})년 \((\d+)월 (추정|집계)\)$")

_perf_cached_df: pd.DataFrame = pd.DataFrame()
_perf_last_loaded = None
_perf_cached_mtime = None
_perf_cache_lock = threading.Lock()

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

_PERF_COL_MAPS = {
    "2026년 (6월 집계)": _PERF_COL_MAP_JUN,
    "2026년 (7월 추정)": _PERF_COL_MAP_JUL,
    "2026년 (8월 추정)": _PERF_COL_MAP_AUG,
}


def _safe_mtime(path):
    try:
        return os.path.getmtime(path)
    except OSError:
        return None


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


def load_perf_excel():
    """_perf_cache_lock 보유 상태에서만 호출."""
    global _perf_cached_df, _perf_last_loaded, _perf_cached_mtime, PERF_EXCEL_PATH
    # 새 ver 파일을 data/ 에 넣고 reload 만 해도 잡히도록 매 로드마다 재탐색
    PERF_EXCEL_PATH = resolve_perf_excel()
    if not os.path.exists(PERF_EXCEL_PATH):
        logger.warning("PERF_EXCEL_PATH 없음: %s", PERF_EXCEL_PATH)
        _perf_cached_df   = pd.DataFrame()
        _perf_last_loaded = None
        _perf_cached_mtime = None
        return _perf_cached_df

    _perf_engine = "pyxlsb" if PERF_EXCEL_PATH.endswith(".xlsb") else "openpyxl"
    with pd.ExcelFile(PERF_EXCEL_PATH, engine=_perf_engine) as xf:
        resolved_sheet = _resolve_perf_sheet(xf.sheet_names)
        logger.info("실적 시트 자동 선택: %s", resolved_sheet)

        if resolved_sheet not in _PERF_COL_MAPS:
            raise ValueError(
                f"자동 선택된 시트 '{resolved_sheet}'에 대한 컬럼맵이 없습니다. "
                f"scripts/check_perf_headers.py로 헤더를 확인하고 _PERF_COL_MAPS에 추가하세요."
            )
        col_map     = _PERF_COL_MAPS[resolved_sheet]
        col_indices = sorted(col_map.keys())
        df = xf.parse(
            resolved_sheet,
            header=None,
            skiprows=12,
            usecols=col_indices,
        )
    df.columns = [col_map[i] for i in col_indices]
    df.columns = [col_map[i] for i in col_indices]

    df = df[df["project_code"].notna()]
    df["project_code"] = df["project_code"].astype(str).str.strip()
    df = df[df["project_code"] != ""]
    df["use_yn"] = df["use_yn"].astype(str).str.strip()
    df = df[df["use_yn"] == "사용"]
    df = df[df["category"].isin(["매출", "원가"])]

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
    sheet_month_match = _PERF_SHEET_RE.match(resolved_sheet)
    current_month_num = int(sheet_month_match.group(2))
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

    df = df.where(df.notna(), other=None)
    df["filename"] = os.path.basename(PERF_EXCEL_PATH)

    _perf_cached_df   = df
    _perf_last_loaded = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    _perf_cached_mtime = _safe_mtime(PERF_EXCEL_PATH)
    logger.info("실적 엑셀 로드 완료: %d행 (매출 %d, 원가 %d)",
                len(df),
                int((df["category"] == "매출").sum()),
                int((df["category"] == "원가").sum()))
    return df


def get_perf_df() -> pd.DataFrame:
    """파일 mtime이 바뀌면 자동으로 다시 읽는다."""
    global _perf_cached_df, _perf_cached_mtime
    current_mtime = _safe_mtime(PERF_EXCEL_PATH)
    if not _perf_cached_df.empty and current_mtime == _perf_cached_mtime:
        return _perf_cached_df
    with _perf_cache_lock:
        current_mtime = _safe_mtime(PERF_EXCEL_PATH)
        if _perf_cached_df.empty or current_mtime != _perf_cached_mtime:
            try:
                load_perf_excel()
            except Exception as e:
                logger.error("load_perf_excel() 실패: %s", e)
                _perf_cached_df    = pd.DataFrame()
                _perf_cached_mtime = current_mtime
    return _perf_cached_df


_PART_PREFIX_RE = re.compile(r"^[①-⑳]\s*")   # 프론트 stripPartPrefix와 동일 범위

_PROGRESS_PRIORITY = ["제안", "협의", "착수", "중간", "완료", "인큐베이팅", "이월", "드롭", "미정"]


def apply_perf_filters(df: pd.DataFrame) -> pd.DataFrame:
    parts = request.args.getlist("part")
    team  = request.args.get("team", "")
    if parts:
        stripped_part = df["part"].astype(str).apply(lambda p: _PART_PREFIX_RE.sub("", p))
        df = df[stripped_part.isin(parts)]
    if team:
        df = df[df["team"] == team]
    return df


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


# ──────────────────────────────────────────────────────────────
# 실적현황 API
# ──────────────────────────────────────────────────────────────

@perf_bp.route("/api/performance/options")
def api_perf_options():
    df = get_perf_df()
    if df.empty:
        return jsonify({"parts": [], "teams": []})
    parts = sorted(df["part"].dropna().unique().tolist())
    teams = sorted(df["team"].dropna().unique().tolist())
    return jsonify({"parts": parts, "teams": teams})


@perf_bp.route("/api/performance/data")
def api_perf_data():
    df = apply_perf_filters(get_perf_df())
    if df.empty:
        return jsonify({"data": [], "total": 0})
    # 매출 행 + 원가 행 둘 다 반환 (프로젝트코드당 2행) — 프론트에서 '구분' 컬럼으로 구분하고
    # 값이 같은 컬럼은 세로 병합해서 보여준다. 집계(summary)는 계속 rev/cost를 분리해 사용.
    rows = df.copy()
    rows["_row_num"] = rows.index

    search   = request.args.get("search", "").strip()
    field    = request.args.get("field", "").strip()
    str_cols = ["project_code", "project_name", "manager", "part", "team"]
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

    total = len(rows)

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
    if len(rows):
        code = rows["project_code"].astype(str).str.strip()
        is_real_code = code.str.fullmatch(r"[A-Za-z]\d{10,}").fillna(False)
        group_key = code.where(is_real_code, code + "␟" + rows["project_name"].astype(str))
        rows["_group_no"] = (group_key != group_key.shift()).cumsum()

    try:
        page      = max(1, int(request.args.get("page", 1)))
        page_size = min(200, max(1, int(request.args.get("page_size", 30))))
    except (ValueError, TypeError):
        page, page_size = 1, 30

    start = (page - 1) * page_size
    return jsonify({"data": rows.iloc[start:start + page_size].to_dict(orient="records"), "total": total})


@perf_bp.route("/api/performance/summary")
def api_perf_summary():
    df = apply_perf_filters(get_perf_df())
    if df.empty:
        return jsonify({"total": {}, "by_part": {}, "by_progress": {}, "monthly": []})

    rev  = df[df["category"] == "매출"]
    cost = df[df["category"] == "원가"]

    total = {
        "plan_initial":     float(rev["plan_initial"].sum()),
        "plan_cost":        float(cost["plan_initial"].sum()),
        "actual_2025":      float(rev["actual_2025"].sum()),
        "jun_actual":       float(rev["jun_actual"].sum()),
        "jun_cost_actual":  float(cost["jun_actual"].sum()),
        "jun_cost":         float(cost["jun_check_total"].sum()),
        "jun_check_total":  float(rev["jun_check_total"].sum()),
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
    }

    by_part = {}
    for part_name, rev_grp in rev.groupby("part"):
        cost_grp = cost[cost["part"] == part_name]
        by_part[part_name] = {
            "plan_initial":     float(rev_grp["plan_initial"].sum()),
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

    return jsonify({"total": total, "by_part": by_part, "by_progress": by_progress, "monthly": monthly, "loaded_at": _perf_last_loaded})


@perf_bp.route("/api/performance/insights")
def api_perf_insights():
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
        ],
    },
    "planVsActual": {
        "dim": "part",
        "agg_desc": "파트별로 프로젝트 값을 단순 합산한 것입니다 (평균·가중치 없음).",
        "series": [
            {"label": "계획", "category": "매출", "field": "plan_initial",
             "field_desc": "매출행의 '최초 사업계획' 금액 (엑셀 V열)"},
            {"label": "추정 실적", "category": "매출", "field": "jun_check_total",
             "field_desc": "매출행의 '연간 점검 합계' (엑셀 BH열 = 1~12월 합, 미래월 추정 포함)"},
        ],
    },
    "profitRate": {
        "dim": "part",
        "agg_desc": "파트별 단순 합산입니다. 이 화면 값은 매출·원가 '원금액'이며, 손익률(경상손익÷매출)은 여기 없습니다.",
        "series": [
            {"label": "매출", "category": "매출", "field": "jun_check_total",
             "field_desc": "매출행의 연간 점검 합계 (엑셀 BH열)"},
            {"label": "원가", "category": "원가", "field": "jun_check_total",
             "field_desc": "원가행의 연간 점검 합계 (엑셀 BH열) — 매출행 '직접원가(BB열)'와 1:1로 대응"},
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


@perf_bp.route("/api/performance/summary/breakdown")
def api_perf_summary_breakdown():
    """
    실적현황 막대 하나가 '어떤 프로젝트 행들을 합산해서' 나온 값인지 드릴다운.
    - chart:  monthly | planVsActual | profitRate
    - series: 0 | 1  (차트 데이터셋 순서)
    - key:    월 라벨("3월") 또는 파트명(접두 원문자 제거된 표시명)
    필터(part/team)는 summary와 동일하게 적용. 반환 total(억)이 막대값과 일치한다.
    """
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
    if not spec or series_idx not in (0, 1):
        return jsonify({"available": False, "message": f"알 수 없는 차트/시리즈: {chart} / {series_idx}"})

    s     = spec["series"][series_idx]
    field = s["field"]

    if spec["dim"] == "month":
        m = re.match(r"(\d+)", key)
        if not m:
            return jsonify({"available": False, "message": f"월 형식 오류: {key}"})
        field = field.format(mm=f"{int(m.group(1)):02d}")
        sub   = df[df["category"] == s["category"]]
        key_label = key
    else:  # part
        stripped  = df["part"].astype(str).apply(lambda p: _PART_PREFIX_RE.sub("", p).strip())
        sub       = df[(df["category"] == s["category"]) & (stripped == key)]
        key_label = key

    if field not in sub.columns:
        return jsonify({"available": False, "message": f"'{field}' 컬럼을 찾을 수 없습니다."})

    raw_sum  = 0.0
    rows_out = []
    for _, r in sub.iterrows():
        raw = r.get(field)
        v   = float(raw) if pd.notna(raw) else 0.0
        if v == 0:
            continue
        raw_sum += v
        rows_out.append({
            "project_code": str(r.get("project_code", "")).strip(),
            "project_name": str(r.get("project_name", "")).strip(),
            "part":  str(r.get("part", "")).strip(),
            "team":  str(r.get("team", "")).strip(),
            "value": round(v / 100_000, 1),   # 천원 → 억
        })
    rows_out.sort(key=lambda x: x["value"], reverse=True)

    return jsonify({
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
    })


@perf_bp.route("/api/performance/reload", methods=["POST"])
def api_perf_reload():
    try:
        with _perf_cache_lock:
            load_perf_excel()
            count     = len(_perf_cached_df)
            loaded_at = _perf_last_loaded
        return jsonify({"ok": True, "loaded_at": loaded_at, "count": count})
    except Exception as e:
        logger.error("api_perf_reload 실패: %s", e)
        return jsonify({"ok": False, "error": str(e)}), 500
