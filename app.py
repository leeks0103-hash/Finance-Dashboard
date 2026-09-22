import logging

import numpy as np
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template
from flask.json.provider import DefaultJSONProvider
from openpyxl import load_workbook

from finance import finance_bp, get_df, load_excel, _sort_stages, _cache_lock, EXCEL_PATH
from performance import perf_bp
from kpi import kpi_bp, get_kpi_df, _real_code, KPI_EXCEL_PATH
from downloads import download_bp
from ai_insight import ai_bp

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
app.register_blueprint(ai_bp)


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

    conflicts = _read_code_conflicts()
    return jsonify({
        "count": len(rows) + len(conflicts),
        "rows": rows,
        "conflicts": conflicts,
    })


def _classify_conflict(code: str, fin_df, kpi_df, kpi_code_col: str, kpi_part_col: str):
    """코드충돌 1건이 '진짜 다른 프로젝트 충돌'인지 '한 파일에 여러 프로젝트가 있고 배치
    보고서 제목만 단계마다 바뀐 것'(정상)인지 자동 판별.

    2026-09-21: E040600126050001/E069600126050001("매치업" 계열) 사례를 사람이 직접
    파트·금액·비고를 대조해 오탐으로 판정했던 근거를 규칙화 — 같은 코드로 취합 시트에 남은
    모든 행이 파트도 같고 매출 금액도 서로 크게 다르지 않으면(배수 1.5배 이내) 같은 프로젝트가
    단계별로 재보고된 것으로 보고 "likely_same_project", 아니면 "needs_review"로 표시.
    파트가 갈리거나 금액이 크게 벌어지면 진짜 다른 프로젝트가 코드만 겹쳤을 가능성이 높음.
    """
    fin_rows = fin_df[fin_df["project_code"].astype(str).str.strip() == code]
    if not fin_rows.empty:
        parts = set(fin_rows["part"].astype(str).str.strip())
        if len(parts) > 1:
            return "needs_review", f"재무 취합에서 파트가 서로 다름: {sorted(parts)}"
        revenues = [v for v in fin_rows["revenue"].tolist() if v and v > 0]
        if revenues:
            lo, hi = min(revenues), max(revenues)
            if hi / lo > 1.5:
                return "needs_review", f"재무 매출 금액 차이가 큼: {lo:,.0f}원 ~ {hi:,.0f}원"
        return "likely_same_project", "재무 취합 기준 파트·매출 금액이 파일 간 일관됨"

    if kpi_code_col and kpi_part_col:
        kpi_rows = kpi_df[kpi_df[kpi_code_col].astype(str).str.strip() == code]
        if not kpi_rows.empty:
            parts = set(kpi_rows[kpi_part_col].astype(str).str.strip())
            if len(parts) > 1:
                return "needs_review", f"KPI 취합에서 파트가 서로 다름: {sorted(parts)}"
            return "likely_same_project", "KPI 취합 기준 파트가 파일 간 일관됨"

    return "needs_review", "취합 시트에서 해당 코드를 찾을 수 없음 — 직접 확인 필요"


def _read_code_conflicts():
    """추출 스크립트가 남긴 '코드충돌' 시트를 읽어 합치고, 각 건을 자동 분류해서 반환.

    서로 다른 PPT가 같은 (코드/연도/단계) 키를 공유하면 뒤에 처리된 파일이 앞 파일의 행을
    덮어써서, **덮어써진 쪽은 취합 시트에 자기 파일명으로 된 행이 아예 안 남는다.**
    위 불일치 검사는 '같은 파일명에 재무·KPI 양쪽 데이터가 있을 때'만 비교하므로 이 경우를
    통째로 놓친다(2026-09-17 실제로 놓친 사례 발견) — 그래서 추출 시점에 기록해둔 충돌을
    여기서 함께 노출한다.

    ⚠️ 파일명 비교만으로는 "한 파일에 여러 프로젝트 + 단계마다 배치 제목이 바뀌는" 케이스를
    구분 못 함(2026-09-18/21 발견, memory: kpi-finance-code-conflict-batch-file-limit) —
    그래서 각 건을 _classify_conflict()로 한 번 더 걸러 verdict를 붙인다.
    """
    # 충돌은 A→B, B→A 양방향으로 기록되므로 (소스, 코드) 단위로 묶어 관련 파일 집합만 남긴다
    grouped = {}
    for source, path in (("재무", EXCEL_PATH), ("KPI", KPI_EXCEL_PATH)):
        try:
            wb = load_workbook(path, data_only=True, read_only=True)
        except Exception:
            continue
        try:
            if "코드충돌" not in wb.sheetnames:
                continue
            for r in wb["코드충돌"].iter_rows(min_row=2, values_only=True):
                if not r or not r[0]:
                    continue
                # 재무는 (코드,연도,파트,구분,기존,신규,발견일시) / KPI는 (코드,연도,단계,기존,신규,발견일시)
                existing, new = (r[4], r[5]) if source == "재무" else (r[3], r[4])
                entry = grouped.setdefault((source, str(r[0])), {
                    "source": source, "code": str(r[0]), "files": [],
                })
                for f in (existing, new):
                    f = str(f or "").strip()
                    if f and f not in entry["files"]:
                        entry["files"].append(f)
        finally:
            wb.close()

    fin_df = get_df()
    kpi_df = get_kpi_df()
    kpi_code_col = next((c for c in kpi_df.columns if "프로젝트코드" in str(c)), None) if not kpi_df.empty else None
    kpi_part_col = next((c for c in kpi_df.columns if "파트명" in str(c)), None) if not kpi_df.empty else None
    for entry in grouped.values():
        verdict, reason = _classify_conflict(entry["code"], fin_df, kpi_df, kpi_code_col, kpi_part_col)
        entry["verdict"] = verdict
        entry["reason"] = reason

    # needs_review를 먼저 보여주고, 그다음 파일 개수 많은 순
    return sorted(
        grouped.values(),
        key=lambda e: (e["verdict"] != "needs_review", -len(e["files"]), e["code"]),
    )


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
