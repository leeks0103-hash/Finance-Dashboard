import logging

import numpy as np
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template
from flask.json.provider import DefaultJSONProvider

from finance import finance_bp, get_df, load_excel, _sort_stages, _cache_lock
from performance import perf_bp
from kpi import kpi_bp, get_kpi_df, _real_code
from downloads import download_bp

load_dotenv()

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
app.json = NumpyJSONProvider(app)

app.register_blueprint(finance_bp)
app.register_blueprint(perf_bp)
app.register_blueprint(kpi_bp)
app.register_blueprint(download_bp)


@app.route("/api/data-health")
def api_data_health():
    """KPI/재무 데이터가 같은 PPT 파일을 각자 독립적으로 스캔한다 — 그 파일에서 뽑힌
    프로젝트코드 집합이 KPI 쪽과 재무 쪽에서 서로 다르면 오입력 후보로 본다.
    (한 파일에 프로젝트가 여러 개면 집합 전체가 같은지만 보므로 개수는 무관하게 맞음/틀림 판정)

    둘 다 정식 코드 형식이 아닌 값끼리만 다른 경우(예: "0" vs "-", "코드 생성 예정" 류)는
    실제 오류가 아니라 placeholder 문구 차이일 뿐이라 제외 — 정식 코드가 한쪽이라도
    있는데 서로 안 맞을 때만 경고 대상으로 남긴다.
    """
    fin_df = get_df()
    kpi_df = get_kpi_df()
    if fin_df.empty or kpi_df.empty:
        return jsonify({"count": 0, "rows": []})

    kpi_code_col = next((c for c in kpi_df.columns if "프로젝트코드" in str(c)), None)
    kpi_file_col = next((c for c in kpi_df.columns if "파일명" in str(c)), None)
    if kpi_code_col is None or kpi_file_col is None:
        return jsonify({"count": 0, "rows": []})

    fin_by_file = fin_df.groupby("filename")["project_code"].apply(
        lambda s: frozenset(str(x).strip() for x in s)
    )
    kpi_by_file = kpi_df.groupby(kpi_file_col)[kpi_code_col].apply(
        lambda s: frozenset(str(x).strip() for x in s)
    )

    rows = []
    for f in set(fin_by_file.index) & set(kpi_by_file.index):
        fset, kset = fin_by_file[f], kpi_by_file[f]
        if fset == kset:
            continue
        if not any(_real_code(c) for c in fset | kset):
            continue  # 둘 다 placeholder일 때만 다름 — 실제 오류 아님
        rows.append({
            "file": f,
            "finance_codes": sorted(fset),
            "kpi_codes": sorted(kset),
        })

    return jsonify({"count": len(rows), "rows": rows})


@app.route("/")
def index():
    df     = get_df()
    years  = sorted(df[df["year"].str.strip() != ""]["year"].unique())
    parts  = sorted(df[df["part"].str.strip() != ""]["part"].unique())
    raw_stages = df[df["stage"].str.strip() != ""]["stage"].unique().tolist()
    stages = _sort_stages(raw_stages)
    return render_template("index.html", years=years, parts=parts, stages=stages)


if __name__ == "__main__":
    with _cache_lock:
        load_excel()
    try:
        from waitress import serve
        print("서버 시작: http://0.0.0.0:5000")
        serve(app, host="0.0.0.0", port=5000, threads=4)
    except ImportError:
        app.run(host="0.0.0.0", port=5000, debug=False)
