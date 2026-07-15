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
