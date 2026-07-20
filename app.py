import os
import json
from datetime import datetime
import numpy as np
from flask import Flask, render_template, jsonify, request, make_response
from flask.json.provider import DefaultJSONProvider
import pandas as pd


class NumpyJSONProvider(DefaultJSONProvider):
    def default(self, o):
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, (np.floating,)):
            return float(o)
        if isinstance(o, np.ndarray):
            return o.tolist()
        return super().default(o)


app = Flask(__name__)
app.json_provider_class = NumpyJSONProvider
app.json = NumpyJSONProvider(app)

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
    global _cached_df, _last_loaded
    if not os.path.exists(EXCEL_PATH):
        _cached_df = _sample_df()
        _last_loaded = datetime.now().strftime("%Y-%m-%d %H:%M:%S") + " (샘플)"
        return _cached_df
    df = pd.read_excel(EXCEL_PATH, sheet_name="취합", header=0, usecols=range(15))
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

    str_cols = ["project_code", "year", "part", "stage",
                "note", "filename", "processed_at", "reflected_at"]
    for col in str_cols:
        df[col] = df[col].astype(str).replace("nan", "").replace("0", "")

    _cached_df = df
    _last_loaded = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return df


def get_df() -> pd.DataFrame:
    if _cached_df.empty:
        load_excel()
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
    b = v / 100_000_000
    return f"{b:.1f}억원" if abs(b) >= 1 else f"{v / 10_000:.0f}만원"


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
            "avg_profit_rate": 0, "count": 0, "by_part": {}, "cost_breakdown": {}
        })

    rates = df[df["profit_rate"] > 0]["profit_rate"]
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
    risk = (
        valid[(valid["operating_profit"] < 0) | (valid["profit_rate"] < 5)]
        .nsmallest(5, "operating_profit")
        [["project_code", "part", "stage", "revenue", "operating_profit", "profit_rate"]]
        .to_dict(orient="records")
    )

    part_stats = valid.groupby("part").agg(
        revenue=("revenue", "sum"),
        profit=("operating_profit", "sum"),
        count=("project_code", "count"),
        avg_rate=("profit_rate", lambda x: round(x[x > 0].mean(), 1) if (x > 0).any() else 0),
    )

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

    if best_part and part_stats.loc[best_part, "avg_rate"] > avg_rate:
        gap = round(part_stats.loc[best_part, "avg_rate"] - avg_rate, 1)
        comments.append({
            "type": "positive", "icon": "📈",
            "text": f"<b>{best_part}</b> 파트의 평균 이익율은 <b>{part_stats.loc[best_part, 'avg_rate']}%</b>로, 전체 평균({avg_rate}%)보다 <b>{gap}%p</b> 높습니다."
        })

    if top_rev_part is not None:
        rev_share = round(part_stats.loc[top_rev_part, "revenue"] / total_revenue * 100, 1) if total_revenue else 0
        comments.append({
            "type": "info", "icon": "💼",
            "text": f"매출 비중이 가장 큰 파트는 <b>{top_rev_part}</b>으로, 전체 매출의 <b>{rev_share}%</b>({bil(part_stats.loc[top_rev_part, 'revenue'])})를 차지합니다."
        })

    if biggest is not None:
        comments.append({
            "type": "info", "icon": "🏆",
            "text": f"단일 최대 매출 프로젝트는 <b>{biggest['project_code']}</b>({biggest['part']} · {biggest['stage']})으로 <b>{bil(biggest['revenue'])}</b>입니다."
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
            "text": f"파트 간 이익율 격차가 <b>{gap2}%p</b>입니다. <b>{worst_part}</b> 파트(평균 {part_stats.loc[worst_part, 'avg_rate']}%)의 수익성 개선이 필요합니다."
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
        load_excel()
        return jsonify({"ok": True, "loaded_at": _last_loaded, "count": len(_cached_df)})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/export/pdf")
def api_export_pdf():
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    import io

    df = apply_filters(get_df())
    valid = df[df["revenue"] > 0]

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            rightMargin=15*mm, leftMargin=15*mm,
                            topMargin=15*mm, bottomMargin=15*mm)

    # 폰트 등록 (윈도우 기본 폰트)
    font_path = "C:/Windows/Fonts/malgun.ttf"
    if os.path.exists(font_path):
        pdfmetrics.registerFont(TTFont("Malgun", font_path))
        font_name = "Malgun"
    else:
        font_name = "Helvetica"

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", fontName=font_name, fontSize=16, spaceAfter=6)
    sub_style = ParagraphStyle("sub", fontName=font_name, fontSize=11, spaceAfter=4, textColor=colors.HexColor("#374151"))
    normal_style = ParagraphStyle("normal", fontName=font_name, fontSize=9)

    def tbl_style(header_color="#4F46E5"):
        return TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(header_color)),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, -1), font_name),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E5E7EB")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ])

    elements = []

    # 제목
    year_str = request.args.get("year", "전체")
    elements.append(Paragraph(f"재무 현황 보고서 ({year_str})", title_style))
    elements.append(Paragraph(f"출력일: {datetime.now().strftime('%Y-%m-%d %H:%M')}", normal_style))
    elements.append(Spacer(1, 6*mm))

    # 요약 KPI
    elements.append(Paragraph("■ 전체 요약", sub_style))
    rates = valid[valid["profit_rate"] > 0]["profit_rate"]
    avg_rate = round(rates.mean(), 1) if not rates.empty else 0
    kpi_data = [
        ["항목", "금액"],
        ["총 매출", f"{valid['revenue'].sum()/1e8:.1f}억원"],
        ["총 지출", f"{valid['expenditure'].sum()/1e8:.1f}억원"],
        ["경상이익 합계", f"{valid['operating_profit'].sum()/1e8:.1f}억원"],
        ["평균 이익율", f"{avg_rate}%"],
        ["프로젝트 수", f"{len(valid)}건"],
    ]
    t = Table(kpi_data, colWidths=[80*mm, 60*mm])
    t.setStyle(tbl_style())
    elements += [t, Spacer(1, 6*mm)]

    # 파트별 실적
    if not valid.empty:
        elements.append(Paragraph("■ 파트별 실적", sub_style))
        part_stats = valid.groupby("part").agg(
            revenue=("revenue", "sum"),
            profit=("operating_profit", "sum"),
            count=("project_code", "count"),
            avg_rate=("profit_rate", lambda x: round(x[x > 0].mean(), 1) if (x > 0).any() else 0),
        ).reset_index()
        part_data = [["파트", "매출", "경상이익", "평균이익율", "건수"]]
        for _, row in part_stats.iterrows():
            part_data.append([
                row["part"],
                f"{row['revenue']/1e8:.1f}억",
                f"{row['profit']/1e8:.1f}억",
                f"{row['avg_rate']}%",
                f"{int(row['count'])}건",
            ])
        t2 = Table(part_data, colWidths=[50*mm, 35*mm, 35*mm, 30*mm, 25*mm])
        t2.setStyle(tbl_style())
        elements += [t2, Spacer(1, 6*mm)]

    # TOP 5
    top5 = valid[valid["profit_rate"] > 0].nlargest(5, "profit_rate")
    if not top5.empty:
        elements.append(Paragraph("■ 이익율 TOP 5", sub_style))
        top_data = [["프로젝트코드", "파트", "단계", "이익율"]]
        for _, row in top5.iterrows():
            top_data.append([row["project_code"], row["part"], row["stage"], f"{row['profit_rate']}%"])
        t3 = Table(top_data, colWidths=[50*mm, 40*mm, 40*mm, 30*mm])
        t3.setStyle(tbl_style("#059669"))
        elements += [t3, Spacer(1, 6*mm)]

    # 리스크
    risk = valid[(valid["operating_profit"] < 0) | (valid["profit_rate"] < 5)].nsmallest(5, "operating_profit")
    if not risk.empty:
        elements.append(Paragraph("■ 리스크 프로젝트 (손실·이익율 5% 미만)", sub_style))
        risk_data = [["프로젝트코드", "파트", "단계", "경상이익", "이익율"]]
        for _, row in risk.iterrows():
            risk_data.append([
                row["project_code"], row["part"], row["stage"],
                f"{row['operating_profit']/1e4:.0f}만원",
                f"{row['profit_rate']}%",
            ])
        t4 = Table(risk_data, colWidths=[45*mm, 35*mm, 35*mm, 35*mm, 25*mm])
        t4.setStyle(tbl_style("#DC2626"))
        elements += [t4, Spacer(1, 6*mm)]

    doc.build(elements)
    buffer.seek(0)

    filename = f"재무현황_{datetime.now().strftime('%Y%m%d')}.pdf"
    response = make_response(buffer.read())
    response.headers["Content-Type"] = "application/pdf"
    response.headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{filename}"
    return response


if __name__ == "__main__":
    load_excel()
    try:
        from waitress import serve
        print(f"서버 시작: http://0.0.0.0:5000")
        serve(app, host="0.0.0.0", port=5000, threads=4)
    except ImportError:
        app.run(host="0.0.0.0", port=5000, debug=False)
