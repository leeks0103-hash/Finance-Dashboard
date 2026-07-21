import io
import logging
import os
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

EXCEL_PATH = (
    "D:/24.기술교육사업기획팀"
    "\\23. 표준 템플릿 데이터 추출 프로젝트"
    "\\[기술교육실]프로젝트 보고서 수집"
    "\\재무관점 필수 데이터 추출.xlsx"
)

COLUMNS = [
    "project_code", "year", "part", "stage",
    "revenue", "expenditure", "direct_cost", "labor_cost",
    "overhead", "operating_profit", "profit_rate",
    "note", "filename", "processed_at", "reflected_at",
]

_cached_df: pd.DataFrame = pd.DataFrame()
_last_loaded = None
_cache_lock = threading.Lock()  # C-1: 스레드 안전성


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


def load_excel():
    """_cache_lock 을 보유한 상태에서만 호출할 것 (C-1)."""
    global _cached_df, _last_loaded
    if not os.path.exists(EXCEL_PATH):
        # H-7: 운영자가 인지할 수 있도록 로그 출력
        logger.warning("EXCEL_PATH 없음 — 샘플 데이터 사용: %s", EXCEL_PATH)
        _cached_df = _sample_df()
        _last_loaded = datetime.now().strftime("%Y-%m-%d %H:%M:%S") + " [샘플]"
        return _cached_df

    df = pd.read_excel(EXCEL_PATH, sheet_name="취합", header=0, usecols=range(15))

    # M-3: 컬럼 수 검증
    if df.shape[1] != len(COLUMNS):
        raise ValueError(f"엑셀 컬럼 수 불일치: 기대 {len(COLUMNS)}, 실제 {df.shape[1]}")

    df.columns = COLUMNS
    df = df[df["project_code"].notna() & (df["project_code"] != "")]

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

    # M-4: year가 숫자로 저장된 경우 "2024.0" → "2024" 변환
    df["year"] = (
        df["year"].astype(str)
        .str.replace(r"\.0$", "", regex=True)
        .replace("nan", "")
    )

    plain_str_cols = ["project_code", "part", "stage", "note", "filename"]
    for col in plain_str_cols:
        df[col] = df[col].astype(str).replace("nan", "")

    # M-2: 날짜 컬럼 — "2024-01-10 00:00:00" → "2024-01-10"
    for col in ["processed_at", "reflected_at"]:
        df[col] = (
            pd.to_datetime(df[col], errors="coerce")
            .dt.strftime("%Y-%m-%d")
            .fillna("")
        )

    _cached_df = df
    _last_loaded = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
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


@app.route("/")
def index():
    df = get_df()
    years = sorted(df[df["year"].str.strip() != ""]["year"].unique())
    parts = sorted(df[df["part"].str.strip() != ""]["part"].unique())
    stages = sorted(df[df["stage"].str.strip() != ""]["stage"].unique())
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
            "avg_profit_rate": 0, "count": 0, "by_part": {},
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

    return jsonify({
        "total_revenue": df["revenue"].sum(),
        "total_expenditure": df["expenditure"].sum(),
        "total_profit": df["operating_profit"].sum(),
        "avg_profit_rate": round(rates.mean(), 1) if not rates.empty else 0,
        "count": len(df),
        "by_part": by_part,
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

    top5 = (
        valid[valid["profit_rate"] > 0]
        .nlargest(5, "profit_rate")
        [["project_code", "part", "stage", "revenue", "operating_profit", "profit_rate"]]
        .to_dict(orient="records")
    )
    # 손실 프로젝트 우선 → 이익율 낮은 순 (nsmallest는 흑자 대규모 프로젝트를 오분류)
    _risk_pool = valid[(valid["operating_profit"] < 0) | (valid["profit_rate"] < 5)].copy()
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

    # C-2: 동적 값 HTML escape (XSS 방지) — 파트명·프로젝트코드가 사용자 입력 포함 가능
    if best_part and part_stats.loc[best_part, "avg_rate"] > avg_rate:
        gap = round(part_stats.loc[best_part, "avg_rate"] - avg_rate, 1)
        comments.append({
            "type": "positive", "icon": "📈",
            "text": f"<b>{html_escape(best_part)}</b> 파트의 평균 이익율은 <b>{part_stats.loc[best_part, 'avg_rate']}%</b>로, 전체 평균({avg_rate}%)보다 <b>{gap}%p</b> 높습니다."
        })

    if top_rev_part is not None:
        rev_share = round(part_stats.loc[top_rev_part, "revenue"] / total_revenue * 100, 1) if total_revenue else 0
        comments.append({
            "type": "info", "icon": "💼",
            "text": f"매출 비중이 가장 큰 파트는 <b>{html_escape(top_rev_part)}</b>으로, 전체 매출의 <b>{rev_share}%</b>({bil(part_stats.loc[top_rev_part, 'revenue'])})를 차지합니다."
        })

    if biggest is not None:
        comments.append({
            "type": "info", "icon": "🏆",
            "text": f"단일 최대 매출 프로젝트는 <b>{html_escape(str(biggest['project_code']))}</b>({html_escape(str(biggest['part']))} · {html_escape(str(biggest['stage']))})으로 <b>{bil(biggest['revenue'])}</b>입니다."
        })

    if total_cost > 0:
        comments.append({
            "type": "neutral", "icon": "📊",
            "text": f"전체 원가 구성: 직접원가 <b>{round(total_dc/total_cost*100,1)}%</b> · 직접인건비 <b>{round(total_lc/total_cost*100,1)}%</b> · 공통원가/관리비 <b>{round(total_oh/total_cost*100,1)}%</b>"
        })

    if loss_count > 0:
        comments.append({
            "type": "warning", "icon": "⚠️",
            "text": f"경상이익이 <b>음수(손실)</b>인 프로젝트가 <b>{loss_count}건</b> 있습니다. 원가 구조 점검이 필요합니다."
        })

    if worst_part and best_part and worst_part != best_part:
        gap2 = round(part_stats.loc[best_part, "avg_rate"] - part_stats.loc[worst_part, "avg_rate"], 1)
        comments.append({
            "type": "warning", "icon": "🔍",
            "text": f"파트 간 이익율 격차가 <b>{gap2}%p</b>입니다. <b>{html_escape(worst_part)}</b> 파트(평균 {part_stats.loc[worst_part, 'avg_rate']}%)의 수익성 개선이 필요합니다."
        })

    if total_revenue:
        overall_rate = round(total_profit / total_revenue * 100, 1)
        if overall_rate > 0:
            comments.append({
                "type": "positive", "icon": "✅",
                "text": f"현재 필터 기준 전체 실질 이익율은 <b>{overall_rate}%</b>입니다. (경상이익 합계 ÷ 총매출)"
            })

    return jsonify({"top": top5, "risk": risk, "comments": comments})


@app.route("/api/reload", methods=["POST"])
def api_reload():
    try:
        with _cache_lock:  # C-1: reload도 잠금 보유
            load_excel()
        return jsonify({"ok": True, "loaded_at": _last_loaded, "count": len(_cached_df)})
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
    # 모든 테이블 동일 폭: A4(210mm) - 좌우마진(15mm×2) = 180mm, 5컬럼 균일 구조
    COL_W = [50*mm, 40*mm, 40*mm, 30*mm, 20*mm]

    def tbl_style():
        return TableStyle([
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
                row["project_code"], row["part"], row["stage"],
                f"{row['revenue']/1e8:.1f}억",
                f"{round(row['profit_rate'], 1)}%",
            ])
        t3 = Table(top_data, colWidths=COL_W)
        t3.setStyle(tbl_style())
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
                row["project_code"], row["part"], row["stage"],
                f"{row['operating_profit']/1e8:.1f}억원",
                f"{round(row['profit_rate'], 1)}%",
            ])
            if row["operating_profit"] < 0:
                loss_rows.append(i)
        t4 = Table(risk_data, colWidths=COL_W)
        _style = tbl_style()
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
