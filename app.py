import os
import json
from datetime import datetime
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

EXCEL_PATH = (
    "D:/24.기술교육사업기획팀"
    "\\23. 표준 템플릿 데이터 추출 프로젝트"
    "\\[기술교육실]프로젝트 보고서 수집"
    "\\재무관점 필수 데이터 추출.xlsx"
)

_cached_data = []
_last_loaded = None


def load_excel():
    global _cached_data, _last_loaded
    import openpyxl
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    ws = wb["취합"]
    rows = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        if not r[0]:
            continue
        def safe_num(v):
            if v is None:
                return 0
            try:
                s = str(v).replace('%', '').replace(',', '').strip()
                return float(s)
            except Exception:
                return 0

        profit_rate = r[10]
        if profit_rate is None:
            profit_rate_val = 0
        else:
            try:
                s = str(profit_rate).replace('%', '').strip()
                profit_rate_val = float(s)
            except Exception:
                profit_rate_val = 0

        rows.append({
            "project_code": str(r[0]) if r[0] else "",
            "year": str(r[1]) if r[1] else "",
            "part": str(r[2]) if r[2] else "",
            "stage": str(r[3]) if r[3] else "",
            "revenue": safe_num(r[4]),
            "expenditure": safe_num(r[5]),
            "direct_cost": safe_num(r[6]),
            "labor_cost": safe_num(r[7]),
            "overhead": safe_num(r[8]),
            "operating_profit": safe_num(r[9]),
            "profit_rate": profit_rate_val,
            "note": str(r[11]) if r[11] and str(r[11]) != "0" else "",
            "filename": str(r[12]) if r[12] else "",
            "processed_at": str(r[13]) if r[13] else "",
            "reflected_at": str(r[14]) if r[14] else "",
        })
    _cached_data = rows
    _last_loaded = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return rows


def get_data():
    if not _cached_data:
        load_excel()
    return _cached_data


@app.route("/")
def index():
    data = get_data()
    years = sorted({r["year"] for r in data if r["year"] and r["year"] != "-"})
    parts = sorted({r["part"] for r in data if r["part"] and r["part"] != "-"})
    stages = sorted({r["stage"] for r in data if r["stage"]})
    return render_template(
        "index.html",
        years=years,
        parts=parts,
        stages=stages,
        last_loaded=_last_loaded,
    )


@app.route("/api/data")
def api_data():
    data = get_data()
    year = request.args.get("year", "")
    parts = request.args.getlist("part")
    stages = request.args.getlist("stage")

    filtered = data
    if year:
        filtered = [r for r in filtered if r["year"] == year]
    if parts:
        filtered = [r for r in filtered if r["part"] in parts]
    if stages:
        filtered = [r for r in filtered if r["stage"] in stages]

    return jsonify(filtered)


@app.route("/api/summary")
def api_summary():
    data = get_data()
    year = request.args.get("year", "")
    parts = request.args.getlist("part")
    stages = request.args.getlist("stage")

    filtered = data
    if year:
        filtered = [r for r in filtered if r["year"] == year]
    if parts:
        filtered = [r for r in filtered if r["part"] in parts]
    if stages:
        filtered = [r for r in filtered if r["stage"] in stages]

    total_revenue = sum(r["revenue"] for r in filtered)
    total_expenditure = sum(r["expenditure"] for r in filtered)
    total_profit = sum(r["operating_profit"] for r in filtered)
    rates = [r["profit_rate"] for r in filtered if r["profit_rate"] > 0]
    avg_rate = round(sum(rates) / len(rates), 1) if rates else 0

    # 파트별 집계
    part_map = {}
    for r in filtered:
        p = r["part"]
        if p not in part_map:
            part_map[p] = {"revenue": 0, "expenditure": 0, "profit": 0, "count": 0}
        part_map[p]["revenue"] += r["revenue"]
        part_map[p]["expenditure"] += r["expenditure"]
        part_map[p]["profit"] += r["operating_profit"]
        part_map[p]["count"] += 1

    # 원가 구성
    cost_breakdown = {
        "direct_cost": sum(r["direct_cost"] for r in filtered),
        "labor_cost": sum(r["labor_cost"] for r in filtered),
        "overhead": sum(r["overhead"] for r in filtered),
    }

    return jsonify({
        "total_revenue": total_revenue,
        "total_expenditure": total_expenditure,
        "total_profit": total_profit,
        "avg_profit_rate": avg_rate,
        "count": len(filtered),
        "by_part": part_map,
        "cost_breakdown": cost_breakdown,
    })


@app.route("/api/insights")
def api_insights():
    data = get_data()
    year = request.args.get("year", "")
    parts = request.args.getlist("part")
    stages = request.args.getlist("stage")

    filtered = data
    if year:
        filtered = [r for r in filtered if r["year"] == year]
    if parts:
        filtered = [r for r in filtered if r["part"] in parts]
    if stages:
        filtered = [r for r in filtered if r["stage"] in stages]

    if not filtered:
        return jsonify({"top": [], "risk": [], "comments": []})

    valid = [r for r in filtered if r["revenue"] > 0]

    # 이익율 기준 TOP 5
    top5 = sorted(
        [r for r in valid if r["profit_rate"] > 0],
        key=lambda r: r["profit_rate"], reverse=True
    )[:5]

    # 손실 or 저수익(5% 미만) 프로젝트
    risk = sorted(
        [r for r in valid if r["operating_profit"] < 0 or r["profit_rate"] < 5],
        key=lambda r: r["operating_profit"]
    )[:5]

    # 파트별 집계
    part_map = {}
    for r in valid:
        p = r["part"]
        if p not in part_map:
            part_map[p] = {"revenue": 0, "profit": 0, "count": 0, "rates": []}
        part_map[p]["revenue"] += r["revenue"]
        part_map[p]["profit"] += r["operating_profit"]
        part_map[p]["count"] += 1
        if r["profit_rate"] > 0:
            part_map[p]["rates"].append(r["profit_rate"])

    total_revenue = sum(r["revenue"] for r in valid)
    total_profit  = sum(r["operating_profit"] for r in valid)
    rates_all     = [r["profit_rate"] for r in valid if r["profit_rate"] > 0]
    avg_rate      = round(sum(rates_all) / len(rates_all), 1) if rates_all else 0
    loss_count    = sum(1 for r in valid if r["operating_profit"] < 0)
    total_dc      = sum(r["direct_cost"] for r in valid)
    total_lc      = sum(r["labor_cost"]  for r in valid)
    total_oh      = sum(r["overhead"]    for r in valid)
    total_cost    = total_dc + total_lc + total_oh

    # 파트별 평균 이익율
    for p in part_map:
        rs = part_map[p]["rates"]
        part_map[p]["avg_rate"] = round(sum(rs) / len(rs), 1) if rs else 0

    best_part  = max(part_map, key=lambda p: part_map[p]["avg_rate"]) if part_map else None
    worst_part = min(part_map, key=lambda p: part_map[p]["avg_rate"]) if part_map else None
    top_rev_part = max(part_map, key=lambda p: part_map[p]["revenue"]) if part_map else None
    biggest = max(valid, key=lambda r: r["revenue"]) if valid else None

    def bil(v):
        b = v / 100000000
        return f"{b:.1f}억원" if abs(b) >= 1 else f"{v/10000:.0f}만원"

    comments = []

    if best_part and part_map[best_part]["avg_rate"] > avg_rate:
        gap = round(part_map[best_part]["avg_rate"] - avg_rate, 1)
        comments.append({
            "type": "positive",
            "icon": "📈",
            "text": f"<b>{best_part}</b> 파트의 평균 이익율은 <b>{part_map[best_part]['avg_rate']}%</b>로, 전체 평균({avg_rate}%)보다 <b>{gap}%p</b> 높습니다."
        })

    if top_rev_part:
        rev_share = round(part_map[top_rev_part]["revenue"] / total_revenue * 100, 1) if total_revenue else 0
        comments.append({
            "type": "info",
            "icon": "💼",
            "text": f"매출 비중이 가장 큰 파트는 <b>{top_rev_part}</b>으로, 전체 매출의 <b>{rev_share}%</b>({bil(part_map[top_rev_part]['revenue'])})를 차지합니다."
        })

    if biggest:
        comments.append({
            "type": "info",
            "icon": "🏆",
            "text": f"단일 최대 매출 프로젝트는 <b>{biggest['project_code']}</b>({biggest['part']} · {biggest['stage']})으로 <b>{bil(biggest['revenue'])}</b>입니다."
        })

    if total_cost > 0:
        lc_ratio = round(total_lc / total_cost * 100, 1)
        dc_ratio = round(total_dc / total_cost * 100, 1)
        oh_ratio = round(total_oh / total_cost * 100, 1)
        comments.append({
            "type": "neutral",
            "icon": "📊",
            "text": f"전체 원가 구성: 직접원가 <b>{dc_ratio}%</b> · 직접인건비 <b>{lc_ratio}%</b> · 공통원가/관리비 <b>{oh_ratio}%</b>"
        })

    if loss_count > 0:
        comments.append({
            "type": "warning",
            "icon": "⚠️",
            "text": f"경상이익이 <b>음수(손실)</b>인 프로젝트가 <b>{loss_count}건</b> 있습니다. 원가 구조 점검이 필요합니다."
        })

    if worst_part and best_part and worst_part != best_part:
        gap2 = round(part_map[best_part]["avg_rate"] - part_map[worst_part]["avg_rate"], 1)
        comments.append({
            "type": "warning",
            "icon": "🔍",
            "text": f"파트 간 이익율 격차가 <b>{gap2}%p</b>입니다. <b>{worst_part}</b> 파트(평균 {part_map[worst_part]['avg_rate']}%)의 수익성 개선이 필요합니다."
        })

    overall_rate = round(total_profit / total_revenue * 100, 1) if total_revenue else 0
    if overall_rate > 0:
        comments.append({
            "type": "positive",
            "icon": "✅",
            "text": f"현재 필터 기준 전체 실질 이익율은 <b>{overall_rate}%</b>입니다. (경상이익 합계 ÷ 총매출)"
        })

    def fmt_row(r):
        return {
            "project_code": r["project_code"],
            "part": r["part"],
            "stage": r["stage"],
            "revenue": r["revenue"],
            "operating_profit": r["operating_profit"],
            "profit_rate": r["profit_rate"],
        }

    return jsonify({
        "top": [fmt_row(r) for r in top5],
        "risk": [fmt_row(r) for r in risk],
        "comments": comments,
    })


@app.route("/api/reload", methods=["POST"])
def api_reload():
    try:
        load_excel()
        return jsonify({"ok": True, "loaded_at": _last_loaded, "count": len(_cached_data)})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


if __name__ == "__main__":
    load_excel()
    try:
        from waitress import serve
        print(f"서버 시작: http://0.0.0.0:5000")
        serve(app, host="0.0.0.0", port=5000, threads=4)
    except ImportError:
        app.run(host="0.0.0.0", port=5000, debug=False)
