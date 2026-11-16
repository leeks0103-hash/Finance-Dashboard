"""프로젝트 상세 열 필터 체크박스(2026-11-16) — "당월 추정 매출"에 "상이만 보기", "당월 추정 직접원가"에 "상이만 보기"·"착수↑만 보기".

`apply_column_filters`의 number 필터에 실린 `flags` 단위 + `/api/performance/data`·`/data/export` 통합.
운영 data/는 읽지도 쓰지도 않음 — 합성 실적 시트와 monkeypatch(재무 대조 결과를 정해진 행에 붙임)만 사용한다.
"""
import io
import json
import os
import sys

import pandas as pd
import pytest
from flask import Flask
from openpyxl import load_workbook

import finance
import performance as P

sys.path.insert(0, os.path.dirname(__file__))
from test_perf_plan_view import N_PAIRS, _make_plan_workbook  # noqa: E402  (합성 실적 시트 만들기 재사용)


def _cf(*specs):
    return json.dumps(list(specs), ensure_ascii=False)


def _num(col, flags=None, **kw):
    f = {"id": col, "type": "number", "unit": "pct", **kw}
    if flags is not None:
        f["flags"] = flags
    return f


# ── 단위 ─────────────────────────────────────────────────────

def _frame():
    return pd.DataFrame({
        "jun_check_total": [10.0, 20.0, 30.0, 40.0],
        "est_cost": [1.0, 2.0, 3.0, 4.0],
        "fin_mismatch": [["jun_check_total"], ["est_cost"], ["jun_check_total", "est_cost"], []],
        # True / None / NaN 이 섞여 있어도 NaN 이 '참'으로 새면 안 됨
        "fin_cost_over_start": [None, True, float("nan"), True],
    })


def _idx(rows):
    return list(rows.index)


class TestFlagsUnit:
    def test_revenue_mismatch_only(self):
        out = P.apply_column_filters(_frame(), _cf(_num("jun_check_total", ["mismatch"])))
        assert _idx(out) == [0, 2]

    def test_cost_mismatch_only(self):
        out = P.apply_column_filters(_frame(), _cf(_num("est_cost", ["mismatch"])))
        assert _idx(out) == [1, 2]

    def test_cost_over_start_only(self):
        out = P.apply_column_filters(_frame(), _cf(_num("est_cost", ["over_start"])))
        assert _idx(out) == [1, 3]                  # 행 2(NaN)는 빠짐

    def test_cost_both_checked_is_or(self):
        out = P.apply_column_filters(_frame(), _cf(_num("est_cost", ["mismatch", "over_start"])))
        assert _idx(out) == [1, 2, 3]               # 상이{1,2} ∪ 착수↑{1,3}

    def test_flags_and_range_are_and(self):
        out = P.apply_column_filters(_frame(), _cf(_num("jun_check_total", ["mismatch"], min=15)))
        assert _idx(out) == [2]

    def test_flags_on_two_columns_are_and(self):
        out = P.apply_column_filters(_frame(), _cf(_num("jun_check_total", ["mismatch"]), _num("est_cost", ["over_start"])))
        assert _idx(out) == []                      # 매출 상이{0,2} ∩ 착수↑{1,3}

    def test_range_only_still_works_without_flags(self):
        out = P.apply_column_filters(_frame(), _cf(_num("jun_check_total", min=25)))
        assert _idx(out) == [2, 3]

    @pytest.mark.parametrize("flags", [[], ["weird"], "mismatch", {"mismatch": True}, [1, None, ["mismatch"]], None])
    def test_empty_or_bad_flags_mean_no_flag_filter(self, flags):
        out = P.apply_column_filters(_frame(), _cf(_num("est_cost", flags, min=0)))
        assert len(out) == 4

    def test_over_start_is_not_available_on_the_revenue_column(self):
        out = P.apply_column_filters(_frame(), _cf(_num("jun_check_total", ["over_start"])))
        assert len(out) == 4                        # 매출 열엔 착수↑가 없음 → 무시

    def test_flags_on_other_columns_are_ignored(self):
        f = _frame().assign(profit_rate=[1.0, 2.0, 3.0, 4.0])
        out = P.apply_column_filters(f, _cf(_num("profit_rate", ["mismatch"], min=0)))
        assert len(out) == 4

    def test_plan_view_has_no_badges_so_flags_are_ignored(self):
        out = P.apply_column_filters(_frame(), _cf(_num("est_cost", ["mismatch"])), with_finance=False)
        assert len(out) == 4

    def test_frame_without_badge_columns_is_not_filtered(self):
        f = _frame().drop(columns=["fin_mismatch", "fin_cost_over_start"])
        assert len(P.apply_column_filters(f, _cf(_num("est_cost", ["mismatch", "over_start"])))) == 4


# ── 통합 ─────────────────────────────────────────────────────

REV_MIS = {1, 5}
COST_MIS = {1, 6}
OVER = {2, 6, 7}


@pytest.fixture(scope="module")
def plan_df(tmp_path_factory):
    f = tmp_path_factory.mktemp("flags") / "plan.xlsx"
    _make_plan_workbook(f)
    df, _, _, _ = P.read_perf_frame(str(f), view="plan27")
    return df


@pytest.fixture
def client(plan_df, monkeypatch):
    monkeypatch.setattr(P, "get_perf_df", lambda view="actual": plan_df)

    def fake_attach(rows):
        rows = rows.copy()
        n = len(rows)
        rows["fin_mismatch"] = [
            [c for c, s in (("jun_check_total", REV_MIS), ("est_cost", COST_MIS)) if i in s] for i in range(n)]
        rows["fin_cost_over_start"] = [True if i in OVER else None for i in range(n)]
        return rows

    monkeypatch.setattr(P, "_attach_finance_mismatch", fake_attach)
    # 엑셀 내보내기가 재무 이력(배지 숫자)을 읽으므로 운영 data/ 대신 빈 값 — 합성 데이터만 쓴다
    monkeypatch.setattr(finance, "get_df", lambda: finance._empty_df())
    app = Flask(__name__)
    app.register_blueprint(P.perf_bp)
    return app.test_client()


def _total(client, cf, extra=""):
    from urllib.parse import quote
    r = client.get(f"/api/performance/data?page_size=200{extra}&cf=" + quote(cf))
    assert r.status_code == 200
    return r.get_json()["total"]


def test_endpoint_revenue_mismatch(client):
    assert _total(client, _cf(_num("jun_check_total", ["mismatch"]))) == len(REV_MIS)


def test_endpoint_cost_mismatch_and_over_start(client):
    assert _total(client, _cf(_num("est_cost", ["mismatch"]))) == len(COST_MIS)
    assert _total(client, _cf(_num("est_cost", ["over_start"]))) == len(OVER)
    assert _total(client, _cf(_num("est_cost", ["mismatch", "over_start"]))) == len(COST_MIS | OVER)


def test_endpoint_total_is_computed_after_the_filter(client):
    from urllib.parse import quote
    cf = _cf(_num("est_cost", ["mismatch", "over_start"]))
    r = client.get("/api/performance/data?page_size=2&page=2&cf=" + quote(cf)).get_json()
    assert r["total"] == len(COST_MIS | OVER) and len(r["data"]) == 2


def test_endpoint_plan_view_ignores_flags(client):
    assert _total(client, _cf(_num("est_cost", ["mismatch"])), "&view=plan27") == N_PAIRS


def test_endpoint_without_flags_returns_everything(client):
    assert _total(client, _cf(_num("est_cost", min=0))) == N_PAIRS


def test_excel_export_follows_the_flags_and_describes_them(client):
    from urllib.parse import quote
    cf = _cf(_num("est_cost", ["mismatch", "over_start"]))
    e = client.get("/api/performance/data/export?cf=" + quote(cf))
    assert e.status_code == 200
    ws = load_workbook(io.BytesIO(e.data)).active
    rows = list(ws.iter_rows(values_only=True))
    # 제목·조건 설명·머리글 줄은 첫 칸이 글자 — 데이터 행은 첫 칸이 NO.(정수)
    assert len([r for r in rows if isinstance(r[0], int)]) == len(COST_MIS | OVER)
    text = " ".join(str(v) for r in rows for v in r if isinstance(v, str))
    assert "상이만 보기, 착수↑만 보기" in text      # 다운로드 조건 줄에 체크박스 선택도 적힘
