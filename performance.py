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

PERF_EXCEL_PATH = os.environ.get(
    "PERF_EXCEL_PATH",
    os.path.join(_DATA_DIR, "26년 사업계획 통합관리 파일_ver7.11_260805_실적 추정 요청_종합1_피드백_20260811.xlsx"),
)

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
_PERF_COL_MAP_JUL = {
    (idx + 3 if idx >= 41 else idx + 2 if idx == 40 else idx): name
    for idx, name in _PERF_COL_MAP_JUN.items()
}

_PERF_COL_MAPS = {
    "2026년 (6월 집계)": _PERF_COL_MAP_JUN,
    "2026년 (7월 추정)": _PERF_COL_MAP_JUL,
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
    global _perf_cached_df, _perf_last_loaded, _perf_cached_mtime
    if not os.path.exists(PERF_EXCEL_PATH):
        logger.warning("PERF_EXCEL_PATH 없음: %s", PERF_EXCEL_PATH)
        _perf_cached_df   = pd.DataFrame()
        _perf_last_loaded = None
        _perf_cached_mtime = None
        return _perf_cached_df

    _perf_engine = "pyxlsb" if PERF_EXCEL_PATH.endswith(".xlsb") else "openpyxl"
    sheet_names     = pd.ExcelFile(PERF_EXCEL_PATH, engine=_perf_engine).sheet_names
    resolved_sheet  = _resolve_perf_sheet(sheet_names)
    logger.info("실적 시트 자동 선택: %s", resolved_sheet)

    if resolved_sheet not in _PERF_COL_MAPS:
        raise ValueError(
            f"자동 선택된 시트 '{resolved_sheet}'에 대한 컬럼맵이 없습니다. "
            f"scripts/check_perf_headers.py로 헤더를 확인하고 _PERF_COL_MAPS에 추가하세요."
        )
    col_map     = _PERF_COL_MAPS[resolved_sheet]
    col_indices = sorted(col_map.keys())
    df = pd.read_excel(
        PERF_EXCEL_PATH,
        sheet_name=resolved_sheet,
        header=None,
        skiprows=12,
        usecols=col_indices,
        engine=_perf_engine,
    )
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


_PART_PREFIX_RE = re.compile(r"^[①-⑦]\s*")


def apply_perf_filters(df: pd.DataFrame) -> pd.DataFrame:
    parts = request.args.getlist("part")
    team  = request.args.get("team", "")
    if parts:
        stripped_part = df["part"].astype(str).apply(lambda p: _PART_PREFIX_RE.sub("", p))
        df = df[stripped_part.isin(parts)]
    if team:
        df = df[df["team"] == team]
    return df


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
    rev = df[df["category"] == "매출"].copy()
    rev["_row_num"] = rev.index

    search   = request.args.get("search", "").strip()
    field    = request.args.get("field", "").strip()
    str_cols = ["project_code", "project_name", "manager", "part", "team"]
    if search:
        s = search.lower()
        if field in str_cols and field in rev.columns:
            mask = rev[field].astype(str).str.lower().str.contains(s, regex=False, na=False)
        else:
            mask = pd.Series([False] * len(rev), index=rev.index)
            for col in str_cols:
                if col in rev.columns:
                    mask |= rev[col].astype(str).str.lower().str.contains(s, regex=False, na=False)
        rev = rev[mask]

    total = len(rev)
    try:
        page      = max(1, int(request.args.get("page", 1)))
        page_size = min(200, max(1, int(request.args.get("page_size", 30))))
    except (ValueError, TypeError):
        page, page_size = 1, 30

    start = (page - 1) * page_size
    return jsonify({"data": rev.iloc[start:start + page_size].to_dict(orient="records"), "total": total})


@perf_bp.route("/api/performance/summary")
def api_perf_summary():
    df = apply_perf_filters(get_perf_df())
    if df.empty:
        return jsonify({"total": {}, "by_part": {}})

    rev  = df[df["category"] == "매출"]
    cost = df[df["category"] == "원가"]

    pos_rate = rev[rev["profit_rate"] > 0]["profit_rate"]
    total = {
        "plan_initial":     float(rev["plan_initial"].sum()),
        "actual_2025":      float(rev["actual_2025"].sum()),
        "jun_actual":       float(rev["jun_actual"].sum()),
        "jun_cost":         float(cost["jun_actual"].sum()),
        "jun_check_total":  float(rev["jun_check_total"].sum()),
        "operating_profit": float(rev["operating_profit"].sum()),
        "profit_gross":     float(rev["profit_gross"].sum()),
        "cost_direct":      float(rev["cost_direct"].sum()),
        "cost_labor":       float(rev["cost_labor"].sum()),
        "cost_overhead":    float(rev["cost_overhead"].sum()),
        "cost_mgmt":        float(rev["cost_mgmt"].sum()),
        "avg_profit_rate":  round(float(pos_rate.mean()), 1) if not pos_rate.empty else 0,
        "count":            int(len(rev)),
    }

    by_part = {}
    for part_name, rev_grp in rev.groupby("part"):
        cost_grp = cost[cost["part"] == part_name]
        pos = rev_grp[rev_grp["profit_rate"] > 0]["profit_rate"]
        by_part[part_name] = {
            "plan_initial":     float(rev_grp["plan_initial"].sum()),
            "jun_actual":       float(rev_grp["jun_actual"].sum()),
            "jun_cost":         float(cost_grp["jun_actual"].sum()),
            "jun_check_total":  float(rev_grp["jun_check_total"].sum()),
            "operating_profit": float(rev_grp["operating_profit"].sum()),
            "avg_profit_rate":  round(float(pos.mean()), 1) if not pos.empty else 0,
            "count":            int(len(rev_grp)),
        }

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

    return jsonify({"total": total, "by_part": by_part, "monthly": monthly})


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
            "text": f"<b>{html_escape(str(lrow['project_code']))}</b> 손실 {_bil_perf(lrow['operating_profit'])} — 확인 필요",
        })

    worst_rows = valid_achieve[valid_achieve["achieve_rate"] < 70].nsmallest(2, "achieve_rate")
    for _, wrow in worst_rows.iterrows():
        comments.append({
            "type": "warning", "icon": "",
            "text": f"<b>{html_escape(str(wrow['project_code']))}</b> ({html_escape(str(wrow['part']))}) 달성률 {wrow['achieve_rate']}% — 목표 대비 부진",
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
