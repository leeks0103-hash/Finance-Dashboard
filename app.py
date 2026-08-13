import io
import json
import logging
import os
import re
import threading
from datetime import datetime
from urllib.parse import quote

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from flask import Flask, render_template, jsonify, request, make_response
from flask.json.provider import DefaultJSONProvider
from markupsafe import escape as html_escape

load_dotenv()  # .env 파일이 있으면 환경변수로 로드 (없으면 무시)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


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
app.json = NumpyJSONProvider(app)  # M-1: 이중 등록 제거 (json_provider_class 라인 삭제)

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DATA_DIR  = os.path.join(_BASE_DIR, "data")

EXCEL_PATH = os.environ.get(
    "EXCEL_PATH",
    os.path.join(_DATA_DIR, "재무관점 필수 데이터 추출.xlsx"),
)

PERF_EXCEL_PATH = os.environ.get(
    "PERF_EXCEL_PATH",
    os.path.join(_DATA_DIR, "26년 사업계획 통합관리 파일_ver7.11_260805_실적 추정 요청_종합1_피드백_20260811.xlsx"),
)
PERF_SHEET = "2026년 (7월 추정)"

KPI_EXCEL_PATH = os.environ.get(
    "KPI_EXCEL_PATH",
    os.path.join(_DATA_DIR, "KPI 지표 데이터 추출.xlsx"),
)

# 엑셀 실제 컬럼 (15개) — year·part 이미 포함
EXCEL_COLS = [
    "project_code", "year", "part", "stage",
    "revenue", "expenditure", "direct_cost", "labor_cost",
    "overhead", "operating_profit", "profit_rate",
    "note", "filename", "processed_at", "reflected_at",
]

# 내부 표준 컬럼 (EXCEL_COLS와 동일)
COLUMNS = EXCEL_COLS

_cached_df: pd.DataFrame = pd.DataFrame()
_last_loaded = None
_cached_mtime = None  # 파일 mtime — 바뀌면 자동 재로드
_cache_lock = threading.Lock()  # C-1: 스레드 안전성
_last_correction_count = 0

_perf_cached_df: pd.DataFrame = pd.DataFrame()
_perf_last_loaded = None
_perf_cached_mtime = None
_perf_cache_lock = threading.Lock()

_kpi_cache_lock = threading.Lock()
_kpi_cached_mtime = None


def _empty_df() -> pd.DataFrame:
    """엑셀 파일 없거나 로드 실패 시 반환할 빈 DataFrame"""
    return pd.DataFrame(columns=COLUMNS)


def _safe_mtime(path):
    """파일 수정시각 조회 — 없으면 None. 캐시 자동 갱신 판단에 사용."""
    try:
        return os.path.getmtime(path)
    except OSError:
        return None


def _is_valid_code(code: str) -> bool:
    """빈 코드·"0"만 제외 — 나머지는 모두 허용."""
    c = code.strip()
    if not c or c == "0":
        return False
    return True


_PLACEHOLDER_CODE_RE = re.compile(r"예정|미정|생성|추진|신규")


def _is_ranked_valid_code(code: str) -> bool:
    """이익율 상위/저수익 랭킹 전용 — 임시·미배정 코드 제외.
    (프론트 useInsightViewModel.ts의 isValid()와 동일 기준 — 랭킹/자르기 전에 걸러야
    top-N 개수가 임시 코드 혼입 여부에 따라 들쭉날쭉해지지 않는다.)"""
    c = str(code).strip()
    if not c or c == "0":
        return False
    if c.isdigit():
        return False
    if _PLACEHOLDER_CODE_RE.search(c):
        return False
    return True


def _extract_year(filename: str, reflected_at) -> str:
    """파일명 '26년' 패턴 → '2026'. 없으면 반영일시 연도 사용."""
    m = re.search(r"(\d{2})년", str(filename))
    if m:
        return "20" + m.group(1)
    try:
        return str(pd.to_datetime(reflected_at).year)
    except Exception:
        return ""


def _extract_part(filename: str) -> str:
    """파일명 규칙: 프로젝트명_파트명_단계.pptx → 파트명 추출."""
    name = re.sub(r"\.pptx?$", "", str(filename), flags=re.IGNORECASE)
    parts = name.split("_")
    if len(parts) >= 2:
        raw = re.sub(r"[\[\]]", "", parts[-2]).strip()
        if re.fullmatch(r"\d{4,6}", raw):
            return "기타"
        return raw
    return "기타"


def _read_excel_via_com(path: str, sheet_name: str) -> "pd.DataFrame | None":
    """AIP 암호화 Excel을 win32com으로 열어 DataFrame으로 반환."""
    try:
        import pythoncom
        import win32com.client
    except ImportError:
        logger.error("win32com 없음 — pip install pywin32 필요")
        return None

    xl_app = None
    wb_com = None
    try:
        pythoncom.CoInitialize()
        xl_app = win32com.client.DispatchEx("Excel.Application")
        xl_app.Visible = False
        xl_app.DisplayAlerts = False

        abs_path = os.path.abspath(path)
        wb_com = xl_app.Workbooks.Open(
            abs_path,
            UpdateLinks=False,
            ReadOnly=True,
            IgnoreReadOnlyRecommended=True,
        )

        ws = None
        for i in range(1, wb_com.Sheets.Count + 1):
            if wb_com.Sheets(i).Name == sheet_name:
                ws = wb_com.Sheets(i)
                break
        if ws is None:
            logger.error("시트 없음: %s", sheet_name)
            return None

        used = ws.UsedRange
        n_rows = used.Rows.Count
        n_cols = used.Columns.Count

        # COM Value2: 전체 셀 값을 한 번에 가져옴 (tuple of tuples)
        values = used.Value2
        if not values:
            return None

        # 단일 행/열인 경우 tuple이 아닌 단일 값이 올 수 있음
        if not isinstance(values[0], tuple):
            values = [values]

        headers = [str(v) if v is not None else "" for v in values[0]]
        rows    = [list(r) for r in values[1:]]
        df = pd.DataFrame(rows, columns=headers)
        logger.info("win32com Excel 읽기 완료: %d행 %d열", len(df), len(df.columns))
        return df

    except Exception as e:
        logger.error("_read_excel_via_com 실패: %s", e)
        return None
    finally:
        try:
            if wb_com is not None:
                wb_com.Close(False)
        except Exception:
            pass
        try:
            if xl_app is not None:
                xl_app.Quit()
        except Exception:
            pass
        try:
            pythoncom.CoUninitialize()
        except Exception:
            pass


def load_excel():
    """_cache_lock 을 보유한 상태에서만 호출할 것 (C-1)."""
    global _cached_df, _last_loaded, _cached_mtime, _last_correction_count
    if not os.path.exists(EXCEL_PATH):
        logger.error("EXCEL_PATH 없음: %s", EXCEL_PATH)
        _cached_df = _empty_df()
        _last_loaded = None
        _cached_mtime = None
        return _cached_df

    # AIP 암호화 파일 감지 (OLE2 시그니처) → win32com 으로 열기 시도
    with open(EXCEL_PATH, "rb") as _fh:
        _sig = _fh.read(8)
    _is_ole2 = _sig[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"

    if _is_ole2:
        logger.warning("EXCEL_PATH 가 AIP/OLE2 형식 — win32com 으로 읽기 시도: %s", EXCEL_PATH)
        df_all = _read_excel_via_com(EXCEL_PATH, sheet_name="취합")
        if df_all is None:
            logger.error("win32com 읽기 실패 — 빈 데이터 반환")
            _cached_df = _empty_df()
            return _cached_df
    else:
        # 실제 엑셀: 15컬럼 (year·part 포함)
        df_all = pd.read_excel(EXCEL_PATH, sheet_name="취합", header=0, engine="openpyxl")
    actual_cols = df_all.shape[1]

    if actual_cols < len(EXCEL_COLS):
        # 구형 13컬럼 파일이면 샘플 대신 명확한 오류 반환
        raise ValueError(
            f"엑셀 컬럼 수 부족 (기대 {len(EXCEL_COLS)}개, 실제 {actual_cols}개). "
            f"year·part 컬럼이 추가된 최신 추출 스크립트로 재추출 필요. "
            f"헤더: {list(df_all.columns[:5])}"
        )

    df = df_all.iloc[:, :len(EXCEL_COLS)]

    if df.shape[1] != len(EXCEL_COLS):
        raise ValueError(f"엑셀 컬럼 수 불일치: 기대 {len(EXCEL_COLS)}, 실제 {df.shape[1]}")

    df.columns = EXCEL_COLS
    # 완전히 빈 행만 제거 — 불량 코드도 포함해서 전체 오픈
    df = df[df["project_code"].notna() & (df["project_code"].astype(str).str.strip() != "")]

    # year: 엑셀 값 우선, 없으면 파일명에서 파생
    # float → int 변환 후 str ("2025.0" → "2025")
    df["year"] = df["year"].astype(str).str.replace(r'\.0$', '', regex=True).str.strip()
    mask_no_year = df["year"].isin(["", "nan", "None"])
    if mask_no_year.any():
        df.loc[mask_no_year, "year"] = df.loc[mask_no_year].apply(
            lambda r: _extract_year(r["filename"], r["reflected_at"]), axis=1
        )

    # part: 엑셀 값 우선, 없으면 파일명에서 파생
    df["part"] = df["part"].astype(str).str.strip()
    mask_no_part = df["part"].isin(["", "nan", "None"])
    if mask_no_part.any():
        df.loc[mask_no_part, "part"] = df.loc[mask_no_part, "filename"].apply(_extract_part)

    # 날짜 파싱
    for col in ["processed_at", "reflected_at"]:
        df[col] = (
            pd.to_datetime(df[col], errors="coerce")
            .dt.strftime("%Y-%m-%d")
            .fillna("")
        )

    # 숫자 컬럼 정규화
    num_cols = ["revenue", "expenditure", "direct_cost", "labor_cost",
                "overhead", "operating_profit", "profit_rate"]
    for col in num_cols:
        df[col] = (
            df[col].astype(str)
            .str.replace("%", "", regex=False)
            .str.replace(",", "", regex=False)
            .str.strip()
        )
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # PPT 파싱 오류 보정: profit_rate > 200이면 operating_profit/revenue로 재산정
    bad_rate = df["profit_rate"].abs() > 200
    _last_correction_count = int(bad_rate.sum())
    if bad_rate.any():
        bad_rows = df.loc[bad_rate, ["project_code", "filename", "profit_rate"]]
        logger.warning(
            "profit_rate 보정 %d행 (추출 스크립트 확인 필요): %s",
            len(bad_rows),
            bad_rows.to_dict("records"),
        )
    has_revenue = df["revenue"] > 0
    df.loc[bad_rate & has_revenue, "profit_rate"] = (
        df.loc[bad_rate & has_revenue, "operating_profit"]
        / df.loc[bad_rate & has_revenue, "revenue"]
        * 100
    ).round(1)
    df.loc[bad_rate & ~has_revenue, "profit_rate"] = 0

    plain_str_cols = ["project_code", "part", "stage", "note", "filename"]
    for col in plain_str_cols:
        df[col] = df[col].astype(str).str.strip().replace("nan", "")

    # 컬럼 순서를 COLUMNS 표준으로 맞춤
    df = df[COLUMNS]

    _cached_df = df
    _last_loaded = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    _cached_mtime = _safe_mtime(EXCEL_PATH)
    logger.info("엑셀 로드 완료: %d행", len(df))
    return df


def get_df() -> pd.DataFrame:
    """C-1: 이중 체크 잠금 패턴으로 스레드 안전하게 캐시 반환.
    파일 mtime이 바뀌면(=재추출 스크립트가 새로 씀) 자동으로 다시 읽는다."""
    global _cached_df, _last_loaded, _cached_mtime
    current_mtime = _safe_mtime(EXCEL_PATH)
    if not _cached_df.empty and current_mtime == _cached_mtime:  # 빠른 경로
        return _cached_df
    with _cache_lock:
        current_mtime = _safe_mtime(EXCEL_PATH)  # 잠금 후 재확인 (TOCTOU 방지)
        if _cached_df.empty or current_mtime != _cached_mtime:
            try:
                load_excel()
            except Exception as e:
                logger.error("load_excel() 실패, 빈 데이터 반환: %s", e)
                _cached_df = _empty_df()
                _last_loaded = None
                _cached_mtime = current_mtime
        return _cached_df


def apply_filters(df: pd.DataFrame) -> pd.DataFrame:
    years = request.args.getlist("year")
    parts = request.args.getlist("part")
    stages = request.args.getlist("stage")
    if years:
        df = df[df["year"].isin(years)]
    if parts:
        df = df[df["part"].isin(parts)]
    if stages:
        df = df[df["stage"].isin(stages)]
    return df


def bil(v):
    # -0.0 방지: f-string :.1f는 -0.0499...를 "-0.0"으로 포맷함
    return f"{v / 1e8:.1f}".replace("-0.0", "0.0") + "억원"


def _safe_avg_rate(x) -> float:
    """양수 이익율만 평균 — NaN 안전 처리. lambda 대신 재사용 가능한 함수."""
    pos = pd.to_numeric(x, errors="coerce")
    pos = pos[pos > 0].dropna()
    return round(float(pos.mean()), 1) if not pos.empty else 0


def _build_part_stats(df: pd.DataFrame) -> pd.DataFrame:
    """파트별 집계 — api_insights · PDF 공유. avg_rate NaN 전파 방지 포함."""
    return (
        df.groupby("part")
        .agg(
            revenue=("revenue", "sum"),
            profit=("operating_profit", "sum"),
            count=("project_code", "count"),
            avg_rate=("profit_rate", _safe_avg_rate),
        )
        .reset_index()
    )


def _register_pdf_font() -> str:
    """PDF 한글 폰트 — 모듈 로드 시 1회 등록 (요청마다 등록 시도 방지)."""
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        font_path = "C:/Windows/Fonts/malgun.ttf"
        if os.path.exists(font_path) and "Malgun" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("Malgun", font_path))
        return "Malgun" if "Malgun" in pdfmetrics.getRegisteredFontNames() else "Helvetica"
    except Exception:
        return "Helvetica"


_PDF_FONT = _register_pdf_font()


_STAGE_PRIORITY = ["검토", "사업계획", "사전검토", "제안", "착수", "중간", "완료"]


def _sort_stages(stage_list):
    """보고단계를 우선순위 순서로 정렬. 미지정 단계는 알파벳순으로 뒤에 추가."""
    priority_map = {s: i for i, s in enumerate(_STAGE_PRIORITY)}
    known = [s for s in _STAGE_PRIORITY if s in stage_list]
    others = sorted(s for s in stage_list if s not in priority_map)
    return known + others


@app.route("/")
def index():
    df = get_df()
    years = sorted(df[df["year"].str.strip() != ""]["year"].unique())
    parts = sorted(df[df["part"].str.strip() != ""]["part"].unique())
    raw_stages = df[df["stage"].str.strip() != ""]["stage"].unique().tolist()
    stages = _sort_stages(raw_stages)
    return render_template(
        "index.html",
        years=years, parts=parts, stages=stages,
        last_loaded=_last_loaded,
    )


@app.route("/api/data")
def api_data():
    df = apply_filters(get_df())

    search = request.args.get("search", "").strip()
    if search:
        s = search.lower()
        mask = (
            df["project_code"].str.lower().str.contains(s, na=False) |
            df["part"].str.lower().str.contains(s, na=False) |
            df["stage"].str.lower().str.contains(s, na=False) |
            df["note"].str.lower().str.contains(s, na=False)
        )
        df = df[mask]

    total = len(df)
    try:
        page      = max(1, int(request.args.get("page", 1)))
        page_size = min(200, max(1, int(request.args.get("page_size", 30))))
    except (ValueError, TypeError):
        page, page_size = 1, 30

    start  = (page - 1) * page_size
    paged  = df.iloc[start:start + page_size].copy()
    paged["_row_num"] = range(start, start + len(paged))
    records = json.loads(paged.to_json(orient="records", force_ascii=False))
    return jsonify({"data": records, "total": total})


@app.route("/api/summary")
def api_summary():
    df = apply_filters(get_df())
    if df.empty:
        return jsonify({
            "total_revenue": 0, "total_expenditure": 0, "total_profit": 0,
            "avg_profit_rate": 0, "count": 0, "by_part": {}, "by_year": {}, "by_stage": {},
            "cost_breakdown": {"direct_cost": 0, "labor_cost": 0, "overhead": 0},
        })

    # H-1: 전체 행 평균 (손실 프로젝트 제외하지 않음)
    rates = df["profit_rate"]
    by_part = (
        df.groupby("part")
        .agg(
            revenue=("revenue", "sum"),
            expenditure=("expenditure", "sum"),
            profit=("operating_profit", "sum"),
            count=("project_code", "count"),
        )
        .to_dict(orient="index")
    )

    by_year = (
        df.groupby("year")
        .agg(
            revenue=("revenue", "sum"),
            expenditure=("expenditure", "sum"),
            profit=("operating_profit", "sum"),
            count=("project_code", "count"),
            avg_profit_rate=("profit_rate", _safe_avg_rate),
        )
        .to_dict(orient="index")
    )

    STAGE_ORDER = _STAGE_PRIORITY
    # 보고단계별 매출 현황 차트는 필터(연도/파트/보고단계)와 무관하게 항상 전체 데이터 기준
    by_stage_raw = (
        get_df().groupby("stage")
        .agg(
            revenue=("revenue", "sum"),
            expenditure=("expenditure", "sum"),
            profit=("operating_profit", "sum"),
            count=("project_code", "count"),
        )
        .to_dict(orient="index")
    )
    # 단계 순서 정렬 (정의된 순서 우선, 나머지 알파벳)
    known   = [s for s in STAGE_ORDER if s in by_stage_raw]
    unknown = sorted(k for k in by_stage_raw if k not in STAGE_ORDER)
    by_stage = {s: by_stage_raw[s] for s in known + unknown}

    return jsonify({
        "total_revenue": df["revenue"].sum(),
        "total_expenditure": df["expenditure"].sum(),
        "total_profit": df["operating_profit"].sum(),
        "avg_profit_rate": round(rates.mean(), 1) if not rates.empty else 0,
        "count": len(df),
        "by_part": by_part,
        "by_year": by_year,
        "by_stage": by_stage,
        "cost_breakdown": {
            "direct_cost": df["direct_cost"].sum(),
            "labor_cost": df["labor_cost"].sum(),
            "overhead": df["overhead"].sum(),
        },
    })


@app.route("/api/insights")
def api_insights():
    df = apply_filters(get_df())
    valid = df[df["revenue"] > 0].copy()

    if valid.empty:
        return jsonify({"top": [], "risk": [], "comments": []})

    # 유효하지 않은 임시 코드 제외 (미정·숫자만·예정 등) — 랭킹/자르기 전에 걸러야
    # top-N 개수가 임시 코드 혼입 여부에 따라 들쭉날쭉해지지 않는다.
    valid_coded = valid[valid["project_code"].apply(_is_ranked_valid_code)]

    top5 = (
        valid_coded[valid_coded["profit_rate"] > 0]
        .nlargest(10, "profit_rate")
        [["project_code", "part", "stage", "revenue", "operating_profit", "profit_rate"]]
        .to_dict(orient="records")
    )
    _risk_pool = valid_coded[(valid_coded["operating_profit"] < 0) | (valid_coded["profit_rate"] < 5)].copy()
    _risk_pool["_is_loss"] = (_risk_pool["operating_profit"] < 0).astype(int)
    risk = (
        _risk_pool
        .sort_values(["_is_loss", "profit_rate"], ascending=[False, True])
        .head(10)
        .drop(columns=["_is_loss"])  # 임시 정렬 컬럼 제거
        [["project_code", "part", "stage", "revenue", "operating_profit", "profit_rate"]]
        .to_dict(orient="records")
    )

    part_stats = _build_part_stats(valid).set_index("part")

    total_revenue = valid["revenue"].sum()
    total_profit = valid["operating_profit"].sum()
    rates_all = valid[valid["profit_rate"] > 0]["profit_rate"]
    avg_rate = round(rates_all.mean(), 1) if not rates_all.empty else 0
    loss_count = int((valid["operating_profit"] < 0).sum())
    total_dc = valid["direct_cost"].sum()
    total_lc = valid["labor_cost"].sum()
    total_oh = valid["overhead"].sum()
    total_cost = total_dc + total_lc + total_oh

    best_part = part_stats["avg_rate"].idxmax() if not part_stats.empty else None
    worst_part = part_stats["avg_rate"].idxmin() if not part_stats.empty else None
    top_rev_part = part_stats["revenue"].idxmax() if not part_stats.empty else None
    biggest = valid.nlargest(1, "revenue").iloc[0] if not valid.empty else None

    comments = []

    # C-2: 동적 값 HTML escape (XSS 방지)
    # 실무형 투박체 — AI 요약 문구 지양, 핵심 수치+행동 중심

    # 손실 프로젝트 — 가장 먼저, 가장 중요
    loss_rows = valid[valid["operating_profit"] < 0].nsmallest(3, "operating_profit")
    for _, lrow in loss_rows.iterrows():
        comments.append({
            "type": "warning", "icon": "",
            "text": f"<b>{html_escape(str(lrow['project_code']))}</b> 손실 {bil(lrow['operating_profit'])} — 확인 필요"
        })

    # 저수익 (손실 아닌 5% 미만)
    thin_rows = valid[(valid["operating_profit"] >= 0) & (valid["profit_rate"] < 5)].nsmallest(2, "profit_rate")
    for _, trow in thin_rows.iterrows():
        comments.append({
            "type": "warning", "icon": "",
            "text": f"<b>{html_escape(str(trow['project_code']))}</b> ({html_escape(str(trow['part']))}) 이익율 {round(trow['profit_rate'],1)}% — 저수익"
        })

    # 파트 간 격차
    if worst_part and best_part and worst_part != best_part:
        gap2 = round(part_stats.loc[best_part, "avg_rate"] - part_stats.loc[worst_part, "avg_rate"], 1)
        comments.append({
            "type": "warning", "icon": "",
            "text": f"<b>{html_escape(worst_part)}</b> 이익율 {part_stats.loc[worst_part, 'avg_rate']}% — {html_escape(best_part)} 대비 -{gap2}%p"
        })

    # 우수 파트
    if best_part and part_stats.loc[best_part, "avg_rate"] > avg_rate:
        gap = round(part_stats.loc[best_part, "avg_rate"] - avg_rate, 1)
        comments.append({
            "type": "positive", "icon": "",
            "text": f"<b>{html_escape(best_part)}</b> 이익율 {part_stats.loc[best_part, 'avg_rate']}% (평균 +{gap}%p)"
        })

    # 최대 매출 프로젝트
    if biggest is not None:
        comments.append({
            "type": "info", "icon": "",
            "text": f"최대 매출 <b>{html_escape(str(biggest['project_code']))}</b> {bil(biggest['revenue'])} ({html_escape(str(biggest['part']))} · {html_escape(str(biggest['stage']))})"
        })

    # 원가 구성 — 숫자만
    if total_cost > 0:
        comments.append({
            "type": "neutral", "icon": "",
            "text": f"원가: 직접 {round(total_dc/total_cost*100,1)}% / 인건비 {round(total_lc/total_cost*100,1)}% / 공통 {round(total_oh/total_cost*100,1)}%"
        })

    # 전체 이익율
    if total_revenue:
        overall_rate = round(total_profit / total_revenue * 100, 1)
        comments.append({
            "type": "positive" if overall_rate >= avg_rate else "neutral", "icon": "",
            "text": f"전체 실질 이익율 <b>{overall_rate}%</b> (필터 기준)"
        })

    return jsonify({"top": top5, "risk": risk, "comments": comments})


@app.route("/api/reload", methods=["POST"])
def api_reload():
    try:
        with _cache_lock:  # C-1: reload도 잠금 보유
            load_excel()
            # 락 내부에서 캡처 — 해제 후 다른 스레드의 덮어쓰기 방지
            local_corrected = _last_correction_count
            local_loaded    = _last_loaded
            local_count     = len(_cached_df)
        return jsonify({
            "ok": True,
            "loaded_at": local_loaded,
            "count": local_count,
            "corrected_rows": local_corrected,
        })
    except Exception as e:
        logger.error("api_reload 실패: %s", e)
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/export/pdf")
def api_export_pdf():
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

    df = apply_filters(get_df())
    valid = df[df["revenue"] > 0]

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            rightMargin=15*mm, leftMargin=15*mm,
                            topMargin=15*mm, bottomMargin=15*mm)

    # 모듈 레벨에서 1회 등록된 폰트 이름 사용
    font_name = _PDF_FONT

    styles = getSampleStyleSheet()
    title_style  = ParagraphStyle("title",  fontName=font_name, fontSize=18, spaceAfter=2,  textColor=colors.black, leading=22)
    sub_style    = ParagraphStyle("sub",    fontName=font_name, fontSize=12, spaceAfter=4,  textColor=colors.black, fontWeight="bold")
    normal_style = ParagraphStyle("normal", fontName=font_name, fontSize=10, spaceAfter=0,  textColor=colors.black)

    # 단일 색상 — 헤더·테두리만 회색, 나머지 전부 검정
    HEADER_COLOR = colors.HexColor("#374151")
    BORDER_COLOR = colors.HexColor("#D1D5DB")
    # A4(210mm) - 좌우마진(15mm×2) = 180mm
    # 요약/파트 테이블 — 균일 5컬럼
    COL_W = [50*mm, 40*mm, 40*mm, 30*mm, 20*mm]
    # 프로젝트 테이블 (TOP5/리스크) — 프로젝트코드 칼럼 넓힘, 파트·단계 좁힘
    PROJECT_COL_W = [70*mm, 22*mm, 22*mm, 36*mm, 30*mm]  # 합계 180mm

    # 프로젝트코드 셀용 Paragraph 스타일 (자동 줄바꿈)
    code_style = ParagraphStyle(
        "code", fontName=font_name, fontSize=8,
        leading=11, wordWrap="LTR", alignment=0,  # LEFT
    )

    def wrap_code(text: str) -> "Paragraph":
        """긴 프로젝트코드를 Paragraph로 감싸 자동 줄바꿈 처리."""
        return Paragraph(str(text), code_style)

    def tbl_style(left_align_col0: bool = False):
        style = TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0),  HEADER_COLOR),
            ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
            ("FONTNAME",      (0, 0), (-1, -1), font_name),
            ("FONTSIZE",      (0, 0), (-1, 0),  10),
            ("FONTSIZE",      (0, 1), (-1, -1), 9),
            ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("GRID",          (0, 0), (-1, -1), 0.4, BORDER_COLOR),
            ("LINEBELOW",     (0, 0), (-1, 0),  1,   colors.white),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ])
        if left_align_col0:
            # 프로젝트코드 칼럼은 좌측 정렬
            style.add("ALIGN", (0, 1), (0, -1), "LEFT")
        return style

    elements = []

    # 제목 — 필터가 있을 때만 괄호에 조건 표시
    _years  = request.args.getlist("year")
    _parts  = request.args.getlist("part")
    _stages = request.args.getlist("stage")
    _filter_labels = []
    if _years:
        _filter_labels.append(", ".join(f"{y}년" for y in _years))
    if _parts:
        _filter_labels.append(", ".join(_parts))
    if _stages:
        _filter_labels.append(", ".join(_stages))

    title_text = "재무 현황 보고서"
    if _filter_labels:
        title_text += f" ({' | '.join(_filter_labels)})"

    elements.append(Paragraph(title_text, title_style))
    elements.append(Paragraph(f"출력일: {datetime.now().strftime('%Y-%m-%d %H:%M')}", normal_style))
    elements.append(Spacer(1, 4*mm))

    # 요약 KPI — 5컬럼 (파트별 실적과 동일 구조)
    elements.append(Paragraph("전체 요약", sub_style))
    rates = valid[valid["profit_rate"] > 0]["profit_rate"]
    avg_rate = round(rates.mean(), 1) if not rates.empty else 0
    kpi_data = [
        ["총 매출", "총 지출", "경상이익", "평균 이익율", "프로젝트 수"],
        [
            f"{valid['revenue'].sum()/1e8:.1f}억원",
            f"{valid['expenditure'].sum()/1e8:.1f}억원",
            f"{valid['operating_profit'].sum()/1e8:.1f}억원",
            f"{avg_rate}%",
            f"{len(valid)}건",
        ],
    ]
    t = Table(kpi_data, colWidths=COL_W)
    t.setStyle(tbl_style())
    elements += [t, Spacer(1, 6*mm)]

    # 파트별 실적 — 5컬럼 180mm
    if not valid.empty:
        elements.append(Paragraph("파트별 실적", sub_style))
        part_stats = _build_part_stats(valid)  # api_insights와 동일 헬퍼 공유
        part_data = [["파트", "매출", "경상이익", "평균이익율", "건수"]]
        for _, row in part_stats.iterrows():
            part_data.append([
                row["part"],
                f"{row['revenue']/1e8:.1f}억",
                f"{row['profit']/1e8:.1f}억",
                f"{row['avg_rate']}%",
                f"{int(row['count'])}건",
            ])
        t2 = Table(part_data, colWidths=COL_W)
        t2.setStyle(tbl_style())
        elements += [t2, Spacer(1, 6*mm)]

    # 이익율 TOP 5 — 5컬럼 (파트별 실적과 동일 구조)
    top5 = valid[valid["profit_rate"] > 0].nlargest(5, "profit_rate")
    if not top5.empty:
        elements.append(Paragraph("이익율 TOP 5", sub_style))
        top_data = [["프로젝트코드", "파트", "단계", "매출", "이익율"]]
        for _, row in top5.iterrows():
            top_data.append([
                wrap_code(row["project_code"]), row["part"], row["stage"],
                f"{row['revenue']/1e8:.1f}억",
                f"{round(row['profit_rate'], 1)}%",
            ])
        t3 = Table(top_data, colWidths=PROJECT_COL_W, repeatRows=1)
        t3.setStyle(tbl_style(left_align_col0=True))
        elements += [t3, Spacer(1, 6*mm)]

    # 리스크 — 5컬럼 (손실 행은 빨간 텍스트 강조)
    _risk_pool = valid[(valid["operating_profit"] < 0) | (valid["profit_rate"] < 5)].copy()
    _risk_pool["_is_loss"] = (_risk_pool["operating_profit"] < 0).astype(int)
    risk = (
        _risk_pool
        .sort_values(["_is_loss", "profit_rate"], ascending=[False, True])
        .head(5)
        .drop(columns=["_is_loss"])  # 임시 정렬 컬럼 제거
    )
    if not risk.empty:
        elements.append(Paragraph("리스크 프로젝트 (손실·이익율 5% 미만)", sub_style))
        risk_data = [["프로젝트코드", "파트", "단계", "경상이익", "이익율"]]
        loss_rows = []  # 손실 행 인덱스 추적 (헤더=0 제외, 데이터 1부터)
        for i, (_, row) in enumerate(risk.iterrows(), start=1):
            risk_data.append([
                wrap_code(row["project_code"]), row["part"], row["stage"],
                f"{row['operating_profit']/1e8:.1f}억원",
                f"{round(row['profit_rate'], 1)}%",
            ])
            if row["operating_profit"] < 0:
                loss_rows.append(i)
        t4 = Table(risk_data, colWidths=PROJECT_COL_W, repeatRows=1)
        _style = tbl_style(left_align_col0=True)
        LOSS_RED = colors.HexColor("#DC2626")
        for r in loss_rows:
            _style.add("TEXTCOLOR", (0, r), (-1, r), LOSS_RED)
        t4.setStyle(_style)
        elements += [t4, Spacer(1, 6*mm)]

    doc.build(elements)
    buffer.seek(0)

    raw_name = f"재무현황_{datetime.now().strftime('%Y%m%d')}.pdf"
    # H-6: RFC 5987 — 한국어 파일명 퍼센트 인코딩 + ASCII 폴백
    encoded_name = quote(raw_name.encode("utf-8"), safe="._-")
    response = make_response(buffer.read())
    response.headers["Content-Type"] = "application/pdf"
    response.headers["Content-Disposition"] = (
        f'attachment; filename="report.pdf"; filename*=UTF-8\'\'{encoded_name}'
    )
    return response


# ──────────────────────────────────────────────────────────────
# 실적 데이터 (사업계획 통합관리 엑셀)
# ──────────────────────────────────────────────────────────────

# 열 인덱스(0-based) → 내부 필드명 (헤더는 12행, 데이터는 13행~)
# ⚠️ 매달 새 시트가 추가될 때마다 컬럼 배치가 통째로 바뀔 수 있음(고정 스키마 아님).
#    새 달 추가 시 scripts/check_perf_headers.py로 헤더를 먼저 확인한 뒤,
#    아래 _PERF_COL_MAPS에 "시트명": {...} 형태로 그 달 전용 맵을 별도로 추가할 것.
#    (지난달 맵을 덮어쓰지 말 것 — 과거 시트를 다시 봐야 할 때 깨짐)
_PERF_COL_MAP_JUN = {
    # ── 식별
    1:  "tech_category",      # 미래기술 분류
    2:  "team",               # 팀
    3:  "part",               # 파트
    4:  "use_yn",             # 사용여부
    5:  "biz_division",       # 사업 분류
    6:  "biz_type",           # 사업구분
    7:  "customer_type",      # 고객구분
    8:  "biz_plan",           # 사업계획
    9:  "progress",           # 진행
    10: "category",           # 구분(매출/원가)
    11: "edu_type",           # 교육형태
    12: "budget_code",        # 예산코드
    13: "project_code",       # 프로젝트코드
    14: "biz_type2",          # 사업유형
    15: "budget_unit",        # 예산단위
    16: "project_name",       # 26년 프로젝트명
    18: "manager",            # 담당자
    # ── 재무
    19: "actual_2025",        # 2025년 실적
    20: "plan_initial",       # 최초사업계획
    21: "plan_cost_rate",     # 최초사업계획 원가율
    22: "course_count",       # 과정
    23: "session_count",      # 차수
    24: "participant_count",  # 인원
    # ── 6월 기준 실적 집계 현황 (두 그룹)
    36: "jun_est",            # 6월 추정 재무
    37: "jun_est_rate",       # 6월 추정 원가율
    38: "jun_actual",         # 6월 실적 집계 재무
    39: "jun_cost_rate",      # 6월 실적 집계 원가율
    40: "cost_rate_diff",     # 원가율 차이(전월비)
    41: "est_vs_actual",      # 당월 추정 대비 실적
    42: "cost_rate_reason",   # 원가율 차이 사유
    # ── 차이(최초 계획 vs 연간 추정)
    43: "plan_diff_amount",   # 차이금액
    44: "plan_diff_rate",     # 증감율
    45: "plan_diff_reason",   # 사유
    # ── 손익 점검
    46: "profit_gross",       # 매출이익
    47: "cost_direct",        # 직접원가
    48: "cost_labor",         # 인건비
    49: "cost_overhead",      # 공통원가
    50: "cost_mgmt",          # 관리비
    51: "operating_profit",   # 경상손익
    52: "profit_rate_raw",    # 손익률(소수)
    # ── 6월 점검
    53: "jun_check_total",    # 합계
    54: "chk_m01",            # 1월
    55: "chk_m02",            # 2월
    56: "chk_m03",            # 3월
    57: "chk_m04",            # 4월
    58: "chk_m05",            # 5월
    59: "chk_m06",            # 6월
    60: "chk_m07",            # 7월
    61: "chk_m08",            # 8월
    62: "chk_m09",            # 9월
    63: "chk_m10",            # 10월
    64: "chk_m11",            # 11월
    65: "chk_m12",            # 12월
    66: "chk_cost_rate",      # 6월 점검 원가율
    67: "chk_course",         # 과정
    68: "chk_session",        # 차수
    69: "chk_participant",    # 인원
    # ── 변동 검토의견 (71~73 중 첫 번째만)
    70: "change_note",        # 변동 검토의견
    # ── 대차
    73: "balance_amount",     # 대차금액
    74: "balance_rate",       # 대차비율
    # ── 참조용
    76: "dup_check",          # 중복 코드 점검
    77: "ref_code",           # 참조 코드
    # ── 신사업파트 직접원가(천원)
    80: "sa_direct_total",    # 소계
    81: "sa_instructor",      # 강사비
    82: "sa_sub_instructor",  # 보조강사비
    83: "sa_venue",           # 강의장
    84: "sa_practice",        # 실습비(노트북)
    85: "sa_textbook",        # 교재비
    86: "sa_other_direct",    # 기타
    # ── 신사업파트 공통원가(천원)
    87: "sa_overhead_total",  # 소계
    88: "sa_refreshment",     # 다과비
    89: "sa_edu_venue",       # 교육장
    90: "sa_parking",         # 주차비
    91: "sa_sw_practice",     # 실습비(SW)
    92: "sa_intern",          # 인턴/파견인건비
    # ── 인건비(천원)
    93: "sa_labor_total",     # 소계
    94: "sa_regular",         # 정규직
    95: "sa_overhead_cost",   # 제경비
    # ── 기타
    97: "note",               # 비고
}

# 2026년 (7월 추정) 시트: 6월 집계(=_PERF_COL_MAP_JUN 기준) 대비 컬럼이 두 군데서 밀림
# (scripts/check_perf_headers.py + 6월 집계 시트 직접 대조로 확인함):
#   - 40번 컬럼 "앞"에 "7월 결산 기준 실적 집계 현황" 재무/원가율 2컬럼 신규 삽입 → 40번부터 +2
#   - 41번 컬럼(당월 추정 대비 실적) "앞"에 "전월 대비 실적" 1컬럼 추가 삽입 → 41번부터 추가 +1 (누적 +3)
# 새로 끼어든 3개 컬럼(40,41=7월 결산 재무/원가율, 43=전월 대비 실적)은 기존 필드와 대응이 없어 미매핑.
_PERF_COL_MAP_JUL = {
    (idx + 3 if idx >= 41 else idx + 2 if idx == 40 else idx): name
    for idx, name in _PERF_COL_MAP_JUN.items()
}

# 시트명 → 그 시트 전용 컬럼맵. 새 달 추가 시 지난 달 항목은 그대로 두고 새 항목만 추가할 것.
_PERF_COL_MAPS = {
    "2026년 (6월 집계)": _PERF_COL_MAP_JUN,
    "2026년 (7월 추정)": _PERF_COL_MAP_JUL,
}


def load_perf_excel():
    """_perf_cache_lock 보유 상태에서만 호출."""
    global _perf_cached_df, _perf_last_loaded, _perf_cached_mtime
    if not os.path.exists(PERF_EXCEL_PATH):
        logger.warning("PERF_EXCEL_PATH 없음: %s", PERF_EXCEL_PATH)
        _perf_cached_df = pd.DataFrame()
        _perf_last_loaded = None
        _perf_cached_mtime = None
        return _perf_cached_df

    if PERF_SHEET not in _PERF_COL_MAPS:
        raise ValueError(
            f"PERF_SHEET='{PERF_SHEET}'에 대한 컬럼맵이 없습니다. "
            f"scripts/check_perf_headers.py로 헤더를 확인하고 _PERF_COL_MAPS에 추가하세요."
        )
    col_map = _PERF_COL_MAPS[PERF_SHEET]
    col_indices = sorted(col_map.keys())
    _perf_engine = "pyxlsb" if PERF_EXCEL_PATH.endswith(".xlsb") else "openpyxl"
    df = pd.read_excel(
        PERF_EXCEL_PATH,
        sheet_name=PERF_SHEET,
        header=None,
        skiprows=12,        # 데이터는 13행(1-based)부터
        usecols=col_indices,
        engine=_perf_engine,
    )
    df.columns = [col_map[i] for i in col_indices]

    # 유효 행: project_code가 있고 category가 매출/원가, 사용여부=사용
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

    # 손익률: 소수 → % (0.07 → 7.0)
    df["profit_rate"] = (df["profit_rate_raw"] * 100).round(1)
    df = df.drop(columns=["profit_rate_raw"])

    # 남은 NaN → None (JSON 직렬화 시 null로 처리, NaN은 유효하지 않은 JSON)
    df = df.where(df.notna(), other=None)

    df["filename"] = os.path.basename(PERF_EXCEL_PATH)
    _perf_cached_df = df
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
                _perf_cached_df = pd.DataFrame()
                _perf_cached_mtime = current_mtime
    return _perf_cached_df


_PART_PREFIX_RE = re.compile(r"^[①-⑦]\s*")


def apply_perf_filters(df: pd.DataFrame) -> pd.DataFrame:
    parts = request.args.getlist("part")
    team  = request.args.get("team", "")
    if parts:
        # 프론트는 "①~⑦" 접두어를 뗀 값을 보냄 — 원본 part 값도 같은 방식으로 벗겨서 비교
        stripped_part = df["part"].astype(str).apply(lambda p: _PART_PREFIX_RE.sub("", p))
        df = df[stripped_part.isin(parts)]
    if team:
        df = df[df["team"] == team]
    return df


@app.route("/api/performance/options")
def api_perf_options():
    """필터 옵션 반환."""
    df = get_perf_df()
    if df.empty:
        return jsonify({"parts": [], "teams": []})
    parts = sorted(df["part"].dropna().unique().tolist())
    teams = sorted(df["team"].dropna().unique().tolist())
    return jsonify({"parts": parts, "teams": teams})


@app.route("/api/performance/data")
def api_perf_data():
    """프로젝트별 실적 (매출 행만). _row_num 필드로 고유 key 보장."""
    df = apply_perf_filters(get_perf_df())
    if df.empty:
        return jsonify({"data": [], "total": 0})
    rev = df[df["category"] == "매출"].copy()
    rev["_row_num"] = rev.index

    search = request.args.get("search", "").strip()
    if search:
        s = search.lower()
        str_cols = ["project_code", "project_name", "manager", "part", "team"]
        mask = pd.Series([False] * len(rev), index=rev.index)
        for col in str_cols:
            if col in rev.columns:
                mask |= rev[col].astype(str).str.lower().str.contains(s, na=False)
        rev = rev[mask]

    total = len(rev)
    try:
        page      = max(1, int(request.args.get("page", 1)))
        page_size = min(200, max(1, int(request.args.get("page_size", 30))))
    except (ValueError, TypeError):
        page, page_size = 1, 30

    start = (page - 1) * page_size
    return jsonify({"data": rev.iloc[start:start + page_size].to_dict(orient="records"), "total": total})


@app.route("/api/performance/summary")
def api_perf_summary():
    """집계 요약: 전체 합계 + 파트별."""
    df = apply_perf_filters(get_perf_df())
    if df.empty:
        return jsonify({"total": {}, "by_part": {}})

    rev  = df[df["category"] == "매출"]
    cost = df[df["category"] == "원가"]

    pos_rate = rev[rev["profit_rate"] > 0]["profit_rate"]
    total = {
        "plan_initial":      float(rev["plan_initial"].sum()),
        "actual_2025":       float(rev["actual_2025"].sum()),
        "jun_actual":        float(rev["jun_actual"].sum()),
        "jun_cost":          float(cost["jun_actual"].sum()),
        "jun_check_total":   float(rev["jun_check_total"].sum()),
        "operating_profit":  float(rev["operating_profit"].sum()),
        "profit_gross":      float(rev["profit_gross"].sum()),
        "cost_direct":       float(rev["cost_direct"].sum()),
        "cost_labor":        float(rev["cost_labor"].sum()),
        "cost_overhead":     float(rev["cost_overhead"].sum()),
        "cost_mgmt":         float(rev["cost_mgmt"].sum()),
        "avg_profit_rate":   round(float(pos_rate.mean()), 1) if not pos_rate.empty else 0,
        "count":             int(len(rev)),
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

    # 월별 집계 — chk_m01~m12 컬럼 합계 (매출 행 기준)
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


@app.route("/api/performance/reload", methods=["POST"])
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


# ──────────────────────────────────────────────────────────────
# KPI 데이터 (KPI 추출 스크립트 결과 엑셀)
# ──────────────────────────────────────────────────────────────

_kpi_raw_df: pd.DataFrame = pd.DataFrame()      # 취합 시트
_kpi_agg_df: pd.DataFrame = pd.DataFrame()      # kpi 집계 시트
_kpi_last_loaded = None


def _safe_num(v) -> float:
    try:
        f = float(v)
        return f if np.isfinite(f) else 0.0
    except Exception:
        return 0.0


def load_kpi_excel():
    """_kpi_cache_lock 보유 상태에서만 호출."""
    global _kpi_raw_df, _kpi_agg_df, _kpi_last_loaded, _kpi_cached_mtime
    if not os.path.exists(KPI_EXCEL_PATH):
        logger.warning("KPI_EXCEL_PATH 없음 — 추출 스크립트 실행 필요: %s", KPI_EXCEL_PATH)
        _kpi_raw_df  = pd.DataFrame()
        _kpi_agg_df  = pd.DataFrame()
        _kpi_last_loaded = None
        _kpi_cached_mtime = None
        return

    with open(KPI_EXCEL_PATH, "rb") as _fh:
        _sig = _fh.read(8)
    if _sig[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
        logger.warning("KPI_EXCEL_PATH 가 AIP/OLE2 형식 — win32com 으로 읽기 시도: %s", KPI_EXCEL_PATH)
        import tempfile, shutil
        tmp = tempfile.mktemp(suffix=".xlsx")
        try:
            import pythoncom, win32com.client as win32
            pythoncom.CoInitialize()
            xl = win32.Dispatch("Excel.Application")
            xl.Visible = False
            xl.DisplayAlerts = False
            wb_com = xl.Workbooks.Open(os.path.abspath(KPI_EXCEL_PATH))
            wb_com.SaveAs(tmp, FileFormat=51)
            wb_com.Close(False)
            xl.Quit()
        except Exception as e:
            logger.error("KPI win32com 변환 실패: %s", e)
            _kpi_raw_df = pd.DataFrame()
            _kpi_agg_df = pd.DataFrame()
            return
        wb = pd.ExcelFile(tmp)
    else:
        wb = pd.ExcelFile(KPI_EXCEL_PATH)
    sheet_names = wb.sheet_names

    if "취합" in sheet_names:
        _kpi_raw_df = wb.parse("취합", header=0)
        # 프로젝트코드 빈 행만 제거 — 불량 코드도 전체 오픈
        code_col = next((c for c in _kpi_raw_df.columns if "프로젝트코드" in str(c)), None)
        if code_col:
            _kpi_raw_df = _kpi_raw_df[
                _kpi_raw_df[code_col].notna() & (_kpi_raw_df[code_col].astype(str).str.strip() != "")
            ].reset_index(drop=True)
        _kpi_raw_df = _kpi_raw_df.fillna(0)
        logger.info("KPI 취합 로드: %d행", len(_kpi_raw_df))
    else:
        _kpi_raw_df = pd.DataFrame()

    if "kpi 집계" in sheet_names:
        _kpi_agg_df = wb.parse("kpi 집계", header=0)
        logger.info("KPI 집계 로드: %d행", len(_kpi_agg_df))
    else:
        _kpi_agg_df = pd.DataFrame()

    _kpi_last_loaded = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    _kpi_cached_mtime = _safe_mtime(KPI_EXCEL_PATH)


def get_kpi_df() -> pd.DataFrame:
    """파일 mtime이 바뀌면 자동으로 다시 읽는다."""
    global _kpi_raw_df, _kpi_cached_mtime
    current_mtime = _safe_mtime(KPI_EXCEL_PATH)
    if not _kpi_raw_df.empty and current_mtime == _kpi_cached_mtime:
        return _kpi_raw_df
    with _kpi_cache_lock:
        current_mtime = _safe_mtime(KPI_EXCEL_PATH)
        if _kpi_raw_df.empty or current_mtime != _kpi_cached_mtime:
            try:
                load_kpi_excel()
            except Exception as e:
                logger.error("load_kpi_excel() 실패: %s", e)
                _kpi_cached_mtime = current_mtime
    return _kpi_raw_df


def _load_kpi_items_from_cache() -> list:
    """캐시된 _kpi_agg_df(kpi 집계)에서 KPI 항목 로드.
    컬럼명 기반으로 항목명과 목표값을 찾아 처리.
    - '구분' 컬럼 → 항목명
    - '26년 목표' 계열에서 숫자 값이 있는 컬럼 → 목표
    pandas는 '-'를 NaN으로 파싱하므로 위치 기반(iloc) 대신 컬럼명 기반으로 처리.
    """
    if _kpi_agg_df.empty:
        return []

    cols = list(_kpi_agg_df.columns)

    # 항목명 컬럼: '구분' 또는 유사 이름
    name_col = next((c for c in cols if "구분" in str(c)), None)
    if name_col is None:
        logger.warning("_load_kpi_items: '구분' 컬럼 없음. 헤더: %s", cols)
        return []

    # 목표 컬럼: '프로젝트' 목표(E열) 우선 — 사업계획(D열)과 구분
    target_col_candidates = [c for c in cols if "목표" in str(c) and "프로젝트" in str(c)]
    if not target_col_candidates:
        target_col_candidates = [c for c in cols if "목표" in str(c)]
    target_col = None
    for c in target_col_candidates:
        if _kpi_agg_df[c].notna().any():
            target_col = c
            break
    if target_col is None and target_col_candidates:
        target_col = target_col_candidates[0]

    items = []
    for _, row in _kpi_agg_df.iterrows():
        name_val = row[name_col] if name_col else None
        if name_val is None or (isinstance(name_val, float) and np.isnan(name_val)):
            continue
        name = str(name_val).strip()
        if not name:
            continue

        target_val = row[target_col] if target_col else None
        agg = "sum" if "건수" in name else "avg"

        if isinstance(target_val, str) and target_val.strip():
            target = target_val.strip()
        elif target_val is None or (isinstance(target_val, float) and np.isnan(target_val)):
            target = 0.0
        else:
            target = _safe_num(target_val)

        items.append({"name": name, "agg": agg, "target": target})

    return items


def _parse_new_old_count(value) -> tuple:
    """'신규:N건/기존:M건' 형식 문자열에서 (신규, 기존) 정수 쌍 추출. 매치 없으면 0."""
    s = str(value)
    m_new = re.search(r"신규\s*:\s*(\d+)건", s)
    m_old = re.search(r"기존\s*:\s*(\d+)건", s)
    return (
        int(m_new.group(1)) if m_new else 0,
        int(m_old.group(1)) if m_old else 0,
    )


def _aggregate_kpi_col(kpi_items: list, col_keyword: str) -> list:
    """취합 시트에서 col_keyword 포함 컬럼들을 KPI 항목 순서대로 집계.
    - 'PJ실적' → 26년 실적, 'PJ유사' → 25년 실적(비교년도)
    - 신규/기존 형식은 신규 건수만 추출
    """
    if _kpi_raw_df.empty:
        return [0.0] * len(kpi_items)

    target_cols = [
        c for c in _kpi_raw_df.columns
        if col_keyword in re.sub(r"\s+", "", str(c))
    ]

    if not target_cols:
        logger.warning("_aggregate_kpi_col: '%s' 컬럼 없음. 헤더: %s",
                       col_keyword, list(_kpi_raw_df.columns[:10]))
        return [0.0] * len(kpi_items)

    if len(target_cols) != len(kpi_items):
        logger.warning("_aggregate_kpi_col: '%s' 컬럼 수(%d) ≠ KPI 항목 수(%d)",
                       col_keyword, len(target_cols), len(kpi_items))

    result = []
    for i, kpi in enumerate(kpi_items):
        col = target_cols[i] if i < len(target_cols) else None
        if col is None:
            result.append(0.0)
            continue

        # 신규/기존 건수 타입 판별 — target이 "신규:N건/기존:N건" 문자열이면 해당
        is_count_type = isinstance(kpi.get("target", 0), str) and "신규" in str(kpi.get("target", ""))

        if is_count_type:
            new_total = 0
            old_total = 0
            for raw_val in _kpi_raw_df[col]:
                if raw_val is None:
                    continue
                val_str = str(raw_val).strip()
                if "신규" in val_str:
                    m_new = re.search(r"신규\s*:\s*(\d+)건", val_str)
                    m_old = re.search(r"기존\s*:\s*(\d+)건", val_str)
                    if m_new:
                        new_total += int(m_new.group(1))
                    if m_old:
                        old_total += int(m_old.group(1))
            result.append(f"신규:{new_total}건/기존:{old_total}건")
            continue

        values = []
        for raw_val in _kpi_raw_df[col]:
            if raw_val is None:
                continue
            val_str = str(raw_val).strip()
            if not val_str or val_str in ("0", "0.0", "nan"):
                continue
            if val_str in ("N", "TBD", "-", "n/a", "N/A"):
                continue
            try:
                cleaned = re.sub(r"[^\d.\-]", "", val_str.replace(",", ""))
                if not cleaned:
                    continue
                f = float(cleaned)
                if np.isfinite(f) and f != 0:
                    values.append(f)
            except (ValueError, TypeError):
                pass

        if not values:
            result.append(0.0)
        elif kpi["agg"] == "sum":
            result.append(round(sum(values), 2))
        else:
            result.append(round(sum(values) / len(values), 2))

    return result


def _calc_kpi_actuals_from_cache(kpi_items: list) -> list:
    """26년 실적 집계 (PJ실적 컬럼)"""
    return _aggregate_kpi_col(kpi_items, "PJ실적")


def _calc_kpi_prev_from_cache(kpi_items: list) -> list:
    """25년 실적 집계 (PJ유사 컬럼 — 비교연도 실적)"""
    return _aggregate_kpi_col(kpi_items, "PJ유사")


def apply_kpi_filters(df: pd.DataFrame) -> pd.DataFrame:
    years  = request.args.getlist("year")
    parts  = request.args.getlist("part")
    stages = request.args.getlist("stage")
    if years:
        df = df[df["수행연도"].isin(years)]
    if parts:
        df = df[df["파트명"].isin(parts)]
    if stages:
        df = df[df["보고단계"].isin(stages)]
    return df


@app.route("/api/kpi/options")
def api_kpi_options():
    """필터 옵션 반환."""
    df = get_kpi_df()
    if df.empty:
        return jsonify({"years": [], "parts": [], "stages": []})
    return jsonify({
        "years":  sorted(df["수행연도"].dropna().unique().tolist()),
        "parts":  sorted(df["파트명"].dropna().unique().tolist()),
        "stages": sorted(df["보고단계"].dropna().unique().tolist()),
    })


@app.route("/api/kpi/data")
def api_kpi_data():
    df = get_kpi_df()
    if df.empty:
        return jsonify({"data": [], "total": 0})

    df = apply_kpi_filters(df)

    search = request.args.get("search", "").strip()
    if search:
        s = search.lower()
        mask = df.apply(
            lambda row: any(s in str(v).lower() for v in row if v is not None),
            axis=1,
        )
        df = df[mask]

    total = len(df)
    try:
        page      = max(1, int(request.args.get("page", 1)))
        page_size = min(200, max(1, int(request.args.get("page_size", 30))))
    except (ValueError, TypeError):
        page, page_size = 1, 30

    start  = (page - 1) * page_size
    paged  = df.iloc[start:start + page_size].copy().replace({float("nan"): None})
    paged["_row_num"] = range(start, start + len(paged))
    return jsonify({"data": paged.to_dict(orient="records"), "total": total})


@app.route("/api/kpi/summary")
def api_kpi_summary():
    if not os.path.exists(KPI_EXCEL_PATH):
        return jsonify({"available": False, "message": "KPI 추출 스크립트를 먼저 실행해주세요."})

    get_kpi_df()  # 캐시 초기화 (파일이 있으면 _kpi_raw_df, _kpi_agg_df 채워짐)

    if _kpi_agg_df.empty:
        return jsonify({"available": False, "message": "kpi 집계 시트를 읽을 수 없습니다."})

    try:
        kpi_items = _load_kpi_items_from_cache()
        actuals   = _calc_kpi_actuals_from_cache(kpi_items)  # 26년 실적 (PJ실적)
        prevs     = _calc_kpi_prev_from_cache(kpi_items)     # 25년 실적 (PJ유사)

        result = []
        for i, kpi in enumerate(kpi_items):
            target   = kpi["target"]
            actual   = actuals[i] if i < len(actuals) else 0.0
            prev     = prevs[i]   if i < len(prevs)   else 0.0

            # 신규/기존 건수 통합 항목 — 그래프·표에서 구분 안 되던 문제 수정: 숫자 2개 항목으로 분리
            if isinstance(target, str) and "신규" in target:
                target_new, target_old = _parse_new_old_count(target)
                actual_new, actual_old = _parse_new_old_count(actual)
                prev_new,   prev_old   = _parse_new_old_count(prev)

                for suffix, t, a, p in (
                    ("신규", target_new, actual_new, prev_new),
                    ("기존", target_old, actual_old, prev_old),
                ):
                    result.append({
                        "name":          kpi["name"].replace("신규/기존", suffix),
                        "agg":           kpi["agg"],
                        "target_2026":   t,
                        "actual_2026":   a,
                        "prev_actual":   p,
                        "achieve_rate":  round(a / t * 100, 1) if t else 0.0,
                    })
                continue

            if isinstance(target, str):
                achieve    = None
                target_out = target
            else:
                target_num = float(target)
                target_out = target_num
                if target_num != 0:
                    achieve = round(actual / target_num * 100, 1)
                else:
                    achieve = 0.0

            result.append({
                "name":          kpi["name"],
                "agg":           kpi["agg"],
                "target_2026":   target_out,
                "actual_2026":   actual,
                "prev_actual":   prev,       # 25년 실적 (PJ유사)
                "achieve_rate":  achieve,
            })

        return jsonify({"available": True, "items": result})

    except Exception as e:
        logger.error("api_kpi_summary 오류: %s", e)
        return jsonify({"available": False, "message": f"KPI 집계 오류: {e}"})


@app.route("/api/kpi/reload", methods=["POST"])
def api_kpi_reload():
    try:
        with _kpi_cache_lock:
            load_kpi_excel()
            count     = len(_kpi_raw_df)
            loaded_at = _kpi_last_loaded
        return jsonify({"ok": True, "loaded_at": loaded_at, "count": count})
    except Exception as e:
        logger.error("api_kpi_reload 실패: %s", e)
        return jsonify({"ok": False, "error": str(e)}), 500


if __name__ == "__main__":
    load_excel()
    try:
        from waitress import serve
        print(f"서버 시작: http://0.0.0.0:5000")
        serve(app, host="0.0.0.0", port=5000, threads=4)
    except ImportError:
        app.run(host="0.0.0.0", port=5000, debug=False)
