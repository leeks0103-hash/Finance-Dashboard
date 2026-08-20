import logging

import numpy as np
from dotenv import load_dotenv
from flask import Flask, render_template
from flask.json.provider import DefaultJSONProvider

from finance import finance_bp, get_df, load_excel, _sort_stages
from performance import perf_bp
from kpi import kpi_bp

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


@app.route("/")
def index():
    df     = get_df()
    years  = sorted(df[df["year"].str.strip() != ""]["year"].unique())
    parts  = sorted(df[df["part"].str.strip() != ""]["part"].unique())
    raw_stages = df[df["stage"].str.strip() != ""]["stage"].unique().tolist()
    stages = _sort_stages(raw_stages)
    return render_template("index.html", years=years, parts=parts, stages=stages)


if __name__ == "__main__":
    load_excel()
    try:
        from waitress import serve
        print("서버 시작: http://0.0.0.0:5000")
        serve(app, host="0.0.0.0", port=5000, threads=4)
    except ImportError:
        app.run(host="0.0.0.0", port=5000, debug=False)
