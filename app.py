import io
import logging
import os
import re
import threading
from datetime import datetime
from urllib.parse import quote

import numpy as np
import pandas as pd
from flask import Flask, render_template, jsonify, request, make_response
from flask.json.provider import DefaultJSONProvider
from markupsafe import escape as html_escape

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

EXCEL_PATH = os.environ.get(
    "EXCEL_PATH",
    r"C:\Users\aaa\Desktop\기술교육실_프로젝트 보고서 수집\재무관점 필수 데이터 추출.xlsx",
)

# 엑셀 실제 컬럼 (13개) — 구분=stage, year/part는 파일명에서 파생
EXCEL_COLS = [
    "project_code", "stage",
    "revenue", "expenditure", "direct_cost", "labor_cost",
    "overhead", "operating_profit", "profit_rate",
    "note", "filename", "processed_at", "reflected_at",
]

# 내부 표준 컬럼 (year·part 파생 포함)
COLUMNS = [
    "project_code", "year", "part", "stage",
    "revenue", "expenditure", "direct_cost", "labor_cost",
    "overhead", "operating_profit", "profit_rate",
    "note", "filename", "processed_at", "reflected_at",
]

_cached_df: pd.DataFrame = pd.DataFrame()
_last_loaded = None
_cache_lock = threading.Lock()  # C-1: 스레드 안전성
_last_correction_count = 0


def _sample_df() -> pd.DataFrame:
    """엑셀 파일 없을 때 UI 확인용 샘플 데이터"""
    rows = [
        ["P001","2024","A파트","최종",    500_000_000, 380_000_000, 200_000_000, 100_000_000, 80_000_000,  120_000_000, 24.0, "", "sample.xlsx", "2024-01-10", "2024-01-15"],
        ["P002","2024","A파트","확정",    320_000_000, 260_000_000, 140_000_000,  70_000_000, 50_000_000,   60_000_000, 18.8, "", "sample.xlsx", "2024-02-01", "2024-02-05"],
        ["P003","2024","B파트","최종",    450_000_000, 400_000_000, 210_000_000, 110_000_000, 80_000_000,   50_000_000, 11.1, "", "sample.xlsx", "2024-01-20", "2024-01-25"],
        ["P004","2024","B파트","중간",    280_000_000, 310_000_000, 160_000_000,  90_000_000, 60_000_000,  -30_000_000, -10.7,"손실주의", "sample.xlsx", "2024-03-01", "2024-03-05"],
        ["P005","2024","C파트","최종",    600_000_000, 420_000_000, 230_000_000, 110_000_000, 80_000_000,  180_000_000, 30.0, "", "sample.xlsx", "2024-01-05", "2024-01-10"],
        ["P006","2024","C파트","확정",    180_000_000, 175_000_000,  90_000_000,  50_000_000, 35_000_000,    5_000_000,  2.8, "저수익", "sample.xlsx", "2024-04-01", "2024-04-03"],
        ["P007","2023","A파트","최종",    400_000_000, 300_000_000, 160_000_000,  80_000_000, 60_000_000,  100_000_000, 25.0, "", "sample.xlsx", "2023-06-01", "2023-06-05"],
        ["P008","2023","B파트","최종",    350_000_000, 290_000_000, 150_000_000,  80_000_000, 60_000_000,   60_000_000, 17.1, "", "sample.xlsx", "2023-07-01", "2023-07-05"],
        ["P009","2023","C파트","확정",    220_000_000, 195_000_000, 100_000_000,  55_000_000, 40_000_000,   25_000_000, 11.4, "", "sample.xlsx", "2023-08-01", "2023-08-03"],
        ["P010","2023","A파트","최종",    550_000_000, 370_000_000, 200_000_000,  90_000_000, 80_000_000,  180_000_000, 32.7, "", "sample.xlsx", "2023-09-01", "2023-09-05"],
    ]
    return pd.DataFrame(rows, columns=COLUMNS)


def _is_valid_code(code: str) -> bool:
    """임시·미정·숫자만 코드 제외 — 프론트엔드와 동일 로직을 백엔드에서 처리."""
    c = code.strip()
    if not c or c == "0":
        return False
    if re.fullmatch(r"\d+", c):
        return False
    if re.search(r"예정|미정|생성|추진|신규", c):
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


def load_excel():
    """_cache_lock 을 보유한 상태에서만 호출할 것 (C-1)."""
    global _cached_df, _last_loaded, _last_correction_count
    if not os.path.exists(EXCEL_PATH):
        logger.warning("EXCEL_PATH 없음 — 샘플 데이터 사용: %s", EXCEL_PATH)
        _cached_df = _sample_df()
        _last_loaded = datetime.now().strftime("%Y-%m-%d %H:%M:%S") + " [샘플]"
        return _cached_df

    # 실제 엑셀: 13컬럼
    df = pd.read_excel(EXCEL_PATH, sheet_name="취합", header=0, usecols=range(13))

    if df.shape[1] != len(EXCEL_COLS):
        raise ValueError(f"엑셀 컬럼 수 불일치: 기대 {len(EXCEL_COLS)}, 실제 {df.shape[1]}")

    df.columns = EXCEL_COLS
    df = df[df["project_code"].notna() & (df["project_code"].astype(str).str.strip() != "")]
    # 임시·미정 코드 행 제거 — 메인 테이블·요약 API 모두에서 제외
    df = df[df["project_code"].astype(str).apply(_is_valid_code)]

    # 날짜 먼저 파싱 (year 파생에 사용)
    for col in ["processed_at", "reflected_at"]:
        df[col] = (
            pd.to_datetime(df[col], errors="coerce")
            .dt.strftime("%Y-%m-%d")
            .fillna("")
        )

    # year · part 파생
    df["year"] = df.apply(
        lambda r: _extract_year(r["filename"], r["reflected_at"]), axis=1
    )
    df["part"] = df["filename"].apply(_extract_part)

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
    logger.info("엑셀 로드 완료: %d행", len(df))
    return df


def get_df() -> pd.DataFrame:
    """C-1: 이중 체크 잠금 패턴으로 스레드 안전하게 캐시 반환."""
    global _cached_df, _last_loaded
    if not _cached_df.empty:  # 빠른 경로 — 대부분의 요청은 여기서 반환
        return _cached_df
    with _cache_lock:
        if _cached_df.empty:  # 잠금 후 재확인 (TOCTOU 방지)
            try:
                load_excel()
            except Exception as e:
                logger.error("load_excel() 실패, 샘플 데이터로 강등: %s", e)
                _cached_df = _sample_df()
                _last_loaded = datetime.now().strftime("%Y-%m-%d %H:%M:%S") + " [샘플-오류]"
        return _cached_df


def apply_filters(df: pd.DataFrame) -> pd.DataFrame:
    year = request.args.get("year", "")
    parts = request.args.getlist("part")
    stages = request.args.getlist("stage")
    if year:
        df = df[df["year"] == year]
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


_STAGE_PRIORITY = ["최종", "완료", "확정", "중간", "착수", "제안", "사전검토", "사업계획", "검토"]


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
    return jsonify(df.to_dict(orient="records"))


@app.route("/api/summary")
def api_summary():
    df = apply_filters(get_df())
    if df.empty:
        return jsonify({
            "total_revenue": 0, "total_expenditure": 0, "total_profit": 0,
            "avg_profit_rate": 0, "count": 0, "by_part": {}, "by_year": {},
            # H-5: 빈 필터에도 항상 모든 키 포함
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

    return jsonify({
        "total_revenue": df["revenue"].sum(),
        "total_expenditure": df["expenditure"].sum(),
        "total_profit": df["operating_profit"].sum(),
        "avg_profit_rate": round(rates.mean(), 1) if not rates.empty else 0,
        "count": len(df),
        "by_part": by_part,
        "by_year": by_year,
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

    # 유효하지 않은 임시 코드 제외 (미정·숫자만·예정 등)
    valid_coded = valid[valid["project_code"].apply(_is_valid_code)]

    top5 = (
        valid_coded[valid_coded["profit_rate"] > 0]
        .nlargest(5, "profit_rate")
        [["project_code", "part", "stage", "revenue", "operating_profit", "profit_rate"]]
        .to_dict(orient="records")
    )
    _risk_pool = valid_coded[(valid_coded["operating_profit"] < 0) | (valid_coded["profit_rate"] < 5)].copy()
    _risk_pool["_is_loss"] = (_risk_pool["operating_profit"] < 0).astype(int)
    risk = (
        _risk_pool
        .sort_values(["_is_loss", "profit_rate"], ascending=[False, True])
        .head(5)
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
        return jsonify({
            "ok": True,
            "loaded_at": _last_loaded,
            "count": len(_cached_df),
            "corrected_rows": _last_correction_count,
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
    _year   = request.args.get("year", "")
    _parts  = request.args.getlist("part")
    _stages = request.args.getlist("stage")
    _filter_labels = []
    if _year:
        _filter_labels.append(f"{_year}년")
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


if __name__ == "__main__":
    load_excel()
    try:
        from waitress import serve
        print(f"서버 시작: http://0.0.0.0:5000")
        serve(app, host="0.0.0.0", port=5000, threads=4)
    except ImportError:
        app.run(host="0.0.0.0", port=5000, debug=False)
