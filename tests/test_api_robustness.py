"""AI QA(2026-11-04)가 찾은 백엔드 견고성 문제 회귀 테스트.

잘못된 입력(타입 틀린 열 필터 JSON·마크업/제어문자·비 ASCII 토큰·빈 값 필터)이 500이 되던 것, 필터 결과 0건 응답의 키 집합,
파트명 정규화, 페이지네이션, /api 오류 형식. 운영 data/는 읽지도 쓰지도 않음 — 합성 데이터와 monkeypatch만 사용한다.
"""
import io
import json
import os
import sys

import pandas as pd
import pytest
from flask import Flask
from openpyxl import load_workbook

import app as app_module
import auth
import downloads
import finance
import kpi
import performance as P
import shared

sys.path.insert(0, os.path.dirname(__file__))
from test_perf_plan_view import N_PAIRS, _make_plan_workbook  # noqa: E402  (합성 실적 시트 만들기 재사용)


# ──────────────────────────────────────────────────────────────
# 공용 픽스처
# ──────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def perf_df(tmp_path_factory):
    """합성 시트를 한 번만 읽어 모듈 안에서 공유(읽기 전용으로만 씀 — 바꿔야 하면 .copy())"""
    f = tmp_path_factory.mktemp("perf") / "plan.xlsx"
    _make_plan_workbook(f)
    df, sheet, year, _ = P.read_perf_frame(str(f), view="plan27")
    return df, sheet, year


@pytest.fixture
def perf_client(perf_df, monkeypatch):
    """실적·계획 두 뷰가 같은 합성 프레임을 돌려주는 미니 앱 — 재무 이력은 빈 값(운영 data 안 읽음)"""
    df, sheet, year = perf_df
    monkeypatch.setattr(P, "get_perf_df", lambda view="actual": df)
    monkeypatch.setitem(P._plan_cache, "year", year)
    monkeypatch.setitem(P._plan_cache, "sheet", sheet)
    monkeypatch.setattr(P, "_perf_current_year", 2026)
    monkeypatch.setattr(P, "_perf_current_month", 9)
    monkeypatch.setattr(finance, "get_df", lambda: finance._empty_df())
    app = Flask(__name__)
    app.register_blueprint(P.perf_bp)
    return app.test_client()


def _fin_df(rows):
    """finance.EXCEL_COLS 16열 DataFrame(숫자 열은 float)"""
    return pd.DataFrame(rows, columns=finance.EXCEL_COLS)


_FIN_ROWS = [
    ["E001", "2024", "AI파트", "완료", 100e6, 80e6, 50e6, 20e6, 10e6, 20e6, 20.0, "", "r1.pptx", "2024-01-01", "2024-01-05", ""],
    ["E002", "2025", "SW파트", "착수", 200e6, 150e6, 90e6, 40e6, 20e6, 50e6, 25.0, "", "r2.pptx", "2025-01-01", "2025-01-05", ""],
]


@pytest.fixture
def fin_client(monkeypatch):
    monkeypatch.setattr(finance, "get_df", lambda: _fin_df(_FIN_ROWS))
    app = Flask(__name__)
    app.register_blueprint(finance.finance_bp)
    return app.test_client()


# ──────────────────────────────────────────────────────────────
# M1 — 열 필터 cf: 타입이 틀린 JSON도 무시하고 200
# ──────────────────────────────────────────────────────────────

BAD_CF = [
    [{"id": ["a"], "type": "text", "q": "a"}],                                   # id가 리스트(unhashable)
    [{"id": {"a": 1}, "type": "text", "q": "a"}],                                # id가 객체
    [{"id": "jun_check_total", "type": "number", "unit": ["x"], "min": 1}],       # unit이 리스트
    [{"id": "part", "type": "select", "values": 5}],                              # values가 숫자
    [{"id": "part", "type": "select", "values": [["a"], {"b": 1}, None]}],        # values 안에 중첩 값
    [{"id": "part", "type": "text", "q": ["x"]}],                                 # q가 리스트
    [{"id": "jun_check_total", "type": "number", "min": 10 ** 400}],              # 아주 큰 수(OverflowError 후보)
    [{"id": "jun_check_total", "type": "number", "min": True, "max": "abc"}],     # bool·문자열
    [None, 3, "x", [1]],                                                          # 항목 자체가 객체가 아님
    {"id": "part"},                                                               # 배열이 아님
]


@pytest.mark.parametrize("view", ["", "&view=plan27"])
@pytest.mark.parametrize("cf", [json.dumps(c) for c in BAD_CF] + ["[" * 20000, "{", "null", ""])
def test_bad_column_filter_is_ignored_with_200(perf_client, cf, view):
    from urllib.parse import quote
    n = perf_client.get(f"/api/performance/data?page_size=5{view}").get_json()["total"]
    r = perf_client.get(f"/api/performance/data?page_size=5{view}&cf=" + quote(cf))
    assert r.status_code == 200
    assert r.get_json()["total"] == n          # 모르는/틀린 항목은 필터 없음과 같음
    # 같은 필터를 쓰는 엑셀 내보내기도 500이 아니어야 함
    e = perf_client.get(f"/api/performance/data/export?{view}&cf=" + quote(cf))
    assert e.status_code == 200


def test_valid_column_filter_still_filters(perf_client):
    cf = json.dumps([{"id": "part", "type": "select", "values": ["파트가"]}])
    d = perf_client.get("/api/performance/data?cf=" + cf).get_json()
    assert 0 < d["total"] < N_PAIRS and all("파트가" in r["part"] for r in d["data"])
    cf = json.dumps([{"id": "part", "type": "text", "q": "파트나"}, {"id": "jun_check_total", "type": "number", "min": 0}])
    assert perf_client.get("/api/performance/data?cf=" + cf).get_json()["total"] > 0


def test_bad_filter_entry_is_skipped_but_good_one_still_applies(perf_client):
    cf = json.dumps([{"id": ["x"], "type": "text", "q": "a"}, {"id": "part", "type": "select", "values": ["파트가"]}])
    d = perf_client.get("/api/performance/data?cf=" + cf).get_json()
    assert 0 < d["total"] < N_PAIRS


# ──────────────────────────────────────────────────────────────
# M2 — PDF: 필터 값·데이터 값은 reportlab 마크업으로 해석되지 않음
# ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("bad", ["<b>x", "</b>", "<unclosed", '<a href="">', "<img src='C:/Windows/win.ini'/>", "a & b", "<font color=red>"])
@pytest.mark.parametrize("param", ["year", "part", "stage"])
def test_pdf_filter_values_are_escaped(fin_client, param, bad):
    from urllib.parse import quote
    r = fin_client.get(f"/api/export/pdf?{param}={quote(bad)}")
    assert r.status_code == 200
    assert r.data.startswith(b"%PDF")


def test_pdf_project_code_with_markup_does_not_break(monkeypatch):
    rows = [["<b>E1", "2024", "AI파트", "완료", 100e6, 80e6, 50e6, 20e6, 10e6, 20e6, 20.0, "", "r.pptx", "", "", ""],
            ["E2 </i> & <x", "2024", "AI파트", "완료", 100e6, 80e6, 50e6, 20e6, 10e6, -5e6, 1.0, "", "r.pptx", "", "", ""]]
    monkeypatch.setattr(finance, "get_df", lambda: _fin_df(rows))
    app = Flask(__name__)
    app.register_blueprint(finance.finance_bp)
    r = app.test_client().get("/api/export/pdf")
    assert r.status_code == 200 and r.data.startswith(b"%PDF")


# ──────────────────────────────────────────────────────────────
# M3 — 프로젝트 상세 엑셀: 제어문자가 들어 있어도 200, 셀엔 지워서 기록
# ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw", ["%01", "%0b", "%00", "%EF%BF%BE", "%EF%BF%BF", "a%01b%0cc", "%1f"])
def test_export_with_control_chars_in_search_is_200(perf_client, raw):
    for view in ("", "&view=plan27"):
        r = perf_client.get(f"/api/performance/data/export?search={raw}{view}")
        assert r.status_code == 200
        load_workbook(io.BytesIO(r.data))      # 열리는 정상 xlsx여야 함
        assert perf_client.get(f"/api/performance/data?search={raw}{view}").status_code == 200


def test_export_with_control_chars_in_column_filter_and_progress(perf_client):
    from urllib.parse import quote
    cf = json.dumps([{"id": "part", "type": "text", "q": "a\x01b\ufffe"}, {"id": "part", "type": "select", "values": ["x\x0b"]}])
    r = perf_client.get("/api/performance/data/export?progress=%01&cf=" + quote(cf))
    assert r.status_code == 200
    ws = load_workbook(io.BytesIO(r.data)).active
    cond = ws["A2"].value
    assert "\x01" not in cond and "\x0b" not in cond and "\ufffe" not in cond


def test_export_data_values_with_illegal_chars_are_cleaned(perf_df):
    import perf_export
    df, _, _ = perf_df
    rows = P._project_rows(df.copy(), with_finance=False).head(3).copy()
    rows["project_name"] = ["이름\x01끝", "=SUM(1,2)", "유니\ufffe코드"]
    data = perf_export.build_project_detail_xlsx(rows, "조건\x00문구")
    ws = load_workbook(io.BytesIO(data)).active
    names = [ws.cell(r, 4).value for r in (6, 7, 8)]
    assert names == ["이름끝", "=SUM(1,2)", "유니코드"]       # 제어문자는 지우고, '='로 시작해도 수식이 아닌 글자
    assert ws["A2"].value == "조건문구"
    assert ws.cell(7, 4).data_type == "s"


def test_clean_text_keeps_normal_whitespace_and_limits_length():
    import perf_export
    assert perf_export._clean_text("a\tb\nc 한글") == "a\tb\nc 한글"
    assert len(perf_export._clean_text("x" * 100_000)) <= 32767


# ──────────────────────────────────────────────────────────────
# M4 — 0건이어도 정상 응답과 같은 키 집합
# ──────────────────────────────────────────────────────────────

def test_perf_summary_zero_rows_has_same_keys_as_normal(perf_client):
    normal = perf_client.get("/api/performance/summary").get_json()
    zero = perf_client.get("/api/performance/summary?part=zzz").get_json()
    assert set(zero) == set(normal)
    assert set(zero["total"]) == set(normal["total"])
    assert zero["base"] == {"year": 2026, "month": 9}            # 필터와 무관한 시트 기준월
    assert zero["by_part"] == {} and zero["by_progress"] == {} and zero["by_team"] == {}
    assert zero["total"]["count"] == 0 and zero["total"]["plan_initial"] == 0
    assert zero["total"]["achieve_rate"] is None                 # 0 ÷ 0은 비율 없음(null)
    assert len(zero["monthly"]) == len(normal["monthly"]) == 12


def test_perf_plan_summary_zero_rows_has_same_keys_as_normal(perf_client):
    normal = perf_client.get("/api/performance/summary?view=plan27").get_json()
    zero = perf_client.get("/api/performance/summary?view=plan27&part=zzz").get_json()
    assert set(zero) == set(normal)
    assert set(zero["total"]) == set(normal["total"])
    assert set(zero["total"]["y27"]) == set(normal["total"]["y27"])
    assert zero["by_part"] == {} and zero["total"]["y27"]["revenue"] == 0


def test_perf_summary_without_any_data_keeps_keys(monkeypatch):
    monkeypatch.setattr(P, "get_perf_df", lambda view="actual": pd.DataFrame())
    monkeypatch.setattr(P, "_perf_current_month", None)
    app = Flask(__name__)
    app.register_blueprint(P.perf_bp)
    body = app.test_client().get("/api/performance/summary").get_json()
    assert {"total", "by_part", "by_team", "by_progress", "monthly", "loaded_at", "base"} <= set(body)


def test_finance_summary_zero_rows_has_same_keys_as_normal(fin_client):
    normal = fin_client.get("/api/summary").get_json()
    zero = fin_client.get("/api/summary?year=1999").get_json()
    assert set(zero) == set(normal)
    assert zero["count"] == 0 and zero["by_part"] == {} and zero["expense_ratio"] is None


def test_data_health_empty_data_keeps_keys(monkeypatch):
    monkeypatch.setattr(app_module, "get_df", lambda: finance._empty_df())
    monkeypatch.setattr(app_module, "get_kpi_df", lambda: pd.DataFrame())
    monkeypatch.setattr(app_module, "_valid_health_acks", lambda: {})
    app_module.app.testing = True
    monkeypatch.setattr(auth, "is_logged_in", lambda req=None: True)
    with app_module.app.test_client() as c:
        body = c.get("/api/data-health").get_json()
    assert {"acks", "count", "rows", "conflicts", "finished_anomalies", "read_failures"} <= set(body)
    assert body["count"] == 0 and body["rows"] == []


def _kpi_frames():
    """KPI 합성 데이터 — 정상 9행(마지막 '신규/기존'은 두 행으로 나뉨)"""
    names = ["NPS", "전략기술 건수", "전략기술 적절성", "특화체계 건수", "AI 고객사 건수", "AI 적절성", "신사업 매출액", "신사업 신규/기존 건수"]
    targets = ["62", "15", "4.0", "12", "10", "4.0", "60.3", "신규:3건/기존:5건"]
    agg = pd.DataFrame({"구분": names, "26년 목표(프로젝트)": targets})
    raw = {"프로젝트코드": ["E1", "E2"], "파트명": ["AI", "SW"], "보고단계": ["착수", "착수"], "수행연도": ["2026", "2026"],
           "파일명": ["a.pptx", "b.pptx"]}
    for i in range(8):
        raw[f"{i}_PJ목표"] = ["5", "5"]
        raw[f"{i}_PJ실적"] = ["4", "6"]
        raw[f"{i}_PJ유사"] = ["3", "3"]
    raw["7_PJ목표"] = ["신규:1건/기존:2건", "신규:2건/기존:3건"]
    raw["7_PJ실적"] = ["신규:1건/기존:1건", "신규:0건/기존:2건"]
    raw["7_PJ유사"] = ["신규:0건/기존:1건", "N"]
    calc = pd.DataFrame(raw)
    return agg, calc


@pytest.fixture
def kpi_client(monkeypatch, tmp_path):
    agg, calc = _kpi_frames()
    fake_xlsx = tmp_path / "kpi.xlsx"
    fake_xlsx.write_bytes(b"x")
    monkeypatch.setattr(kpi, "KPI_EXCEL_PATH", str(fake_xlsx))
    monkeypatch.setattr(kpi, "get_kpi_df", lambda: calc)
    monkeypatch.setattr(kpi, "_kpi_agg_df", agg)
    monkeypatch.setattr(kpi, "_kpi_calc_df", calc)
    monkeypatch.setattr(kpi, "_kpi_raw_df", calc)
    app = Flask(__name__)
    app.register_blueprint(kpi.kpi_bp)
    return app.test_client()


def test_kpi_summary_zero_rows_has_same_row_count_and_plan_targets(kpi_client):
    normal = kpi_client.get("/api/kpi/summary").get_json()
    zero = kpi_client.get("/api/kpi/summary?part=zzz").get_json()
    assert normal["available"] and zero["available"]
    assert len(normal["items"]) == len(zero["items"]) == 9          # 신규/기존이 두 행으로 나뉨
    assert [i["name"] for i in zero["items"]] == [i["name"] for i in normal["items"]]
    assert [i["plan_target"] for i in zero["items"]] == [i["plan_target"] for i in normal["items"]]   # 한 칸씩 어긋나지 않음
    assert all(set(a) == set(b) for a, b in zip(zero["items"], normal["items"]))
    assert zero["items"][-1]["target_2026"] == 0 and zero["items"][-1]["actual_2026"] == 0


def test_zero_agg_makes_count_type_a_string():
    items = [{"name": "a", "target": 3.0, "agg": "avg"}, {"name": "b", "target": "신규:1건/기존:2건", "agg": "sum"}]
    assert kpi._zero_agg(items) == [0.0, "신규:0건/기존:0건"]


# ──────────────────────────────────────────────────────────────
# M5 — 빈 값 필터 파라미터는 필터 없음으로 통일
# ──────────────────────────────────────────────────────────────

def test_nonblank_helper():
    assert shared.nonblank(["", " ", "a", "b "]) == ["a", "b "]
    assert shared.nonblank([]) == []


@pytest.mark.parametrize("qs", ["part=", "year=", "stage=", "part=&year=&stage=", "part=%20"])
def test_finance_blank_filter_means_no_filter(fin_client, qs):
    assert fin_client.get("/api/data").get_json()["total"] == 2
    assert fin_client.get("/api/data?" + qs).get_json()["total"] == 2
    assert fin_client.get("/api/summary?" + qs).get_json()["count"] == 2


def test_finance_blank_value_ignored_next_to_real_value(fin_client):
    assert fin_client.get("/api/data?part=&part=AI파트").get_json()["total"] == 1


def test_kpi_blank_filter_means_no_filter(kpi_client):
    n = kpi_client.get("/api/kpi/data").get_json()["total"]
    assert n == 2
    for qs in ("part=", "year=", "stage=", "part=&year=&stage="):
        assert kpi_client.get("/api/kpi/data?" + qs).get_json()["total"] == n


@pytest.mark.parametrize("qs", ["part=", "part=&part=", "team=", "progress=", "part=%20"])
def test_perf_blank_filter_means_no_filter(perf_client, qs):
    n = perf_client.get("/api/performance/data").get_json()["total"]
    assert perf_client.get("/api/performance/data?" + qs).get_json()["total"] == n
    assert perf_client.get("/api/performance/summary?" + qs).get_json()["total"]["count"] > 0


# ──────────────────────────────────────────────────────────────
# M6 — 옵션 목록의 파트명(원문자 포함)을 그대로 필터·key에 넣어도 일치
# ──────────────────────────────────────────────────────────────

def test_part_filter_accepts_prefixed_and_stripped_names(perf_client):
    opts = perf_client.get("/api/performance/options").get_json()["parts"]
    assert "① 파트가" in opts
    for view in ("", "&view=plan27"):
        a = perf_client.get("/api/performance/data?part=" + "① 파트가" + view).get_json()["total"]
        b = perf_client.get("/api/performance/data?part=" + "파트가" + view).get_json()["total"]
        assert a == b > 0
        s1 = perf_client.get("/api/performance/summary?part=" + "② 파트나" + view).get_json()
        s2 = perf_client.get("/api/performance/summary?part=" + "파트나" + view).get_json()
        assert s1["total"] == s2["total"] and s1["by_part"].keys() == s2["by_part"].keys() and s1["by_part"]
    assert perf_client.get("/api/performance/data/export?part=① 파트가").status_code == 200
    assert perf_client.get("/api/performance/insights?part=① 파트가").status_code == 200


def test_breakdown_key_accepts_prefix_and_unknown_part_is_unavailable(perf_client):
    base = "/api/performance/summary/breakdown?chart=planVsActual&series=0&key="
    a = perf_client.get(base + "① 파트가").get_json()
    b = perf_client.get(base + "파트가").get_json()
    assert a["available"] and b["available"] and a["rows"] == b["rows"] and a["count"] > 0   # 합성 금액은 억 단위로 반올림하면 0.0이라 행으로 비교
    assert a["key"] == "파트가"
    nope = perf_client.get(base + "없는파트").get_json()
    assert nope["available"] is False
    assert perf_client.get(base).get_json()["available"] is False          # key가 비어도 일관되게


def test_breakdown_month_out_of_range_does_not_leak_column_names(perf_client):
    for key in ("13월", "0월", "99월"):
        body = perf_client.get("/api/performance/summary/breakdown?chart=monthly&series=0&key=" + key).get_json()
        assert body["available"] is False and "chk_m" not in body["message"]
    ok = perf_client.get("/api/performance/summary/breakdown?chart=monthly&series=0&key=3월").get_json()
    assert ok["available"] is True


# ──────────────────────────────────────────────────────────────
# M7 — 비 ASCII 토큰·비밀번호가 500이 아니라 인증 실패
# ──────────────────────────────────────────────────────────────

@pytest.fixture
def accounts(monkeypatch):
    monkeypatch.setattr(auth, "_ACCOUNTS", {
        "100": {"password": "한글비번!", "name": "한글", "role": "user"},
        "200": {"password": "ascii-pw", "name": "관리", "role": "admin"},
    })


def test_login_with_non_ascii_password(accounts):
    ok = auth.login("100", "한글비번!")
    assert ok and ok["role"] == "user"
    assert auth.login("100", "한글비번?") is None
    assert auth.login("200", "한글") is None          # 예전엔 TypeError
    assert auth.login("200", "ascii-pw")["role"] == "admin"
    assert auth.login("999", "한글") is None


def test_token_with_non_ascii_is_rejected_not_500(accounts):
    token = auth.login("100", "한글비번!")["token"]
    with app_module.app.test_request_context(f"/api/x?token={token}"):
        assert auth.current_user()["emp_no"] == "100"      # 한글 비밀번호 계정의 정상 토큰도 통과
    for bad in ("100.한글서명", "한글.abc", "100.", ".", "100.abc", "200.한글"):
        with app_module.app.test_request_context("/api/x", headers={"X-Extract-Key": "x"}, query_string={"token": bad}):
            assert auth.current_user() is None


def test_api_returns_401_for_non_ascii_token_when_login_required(accounts, monkeypatch):
    monkeypatch.setattr(auth, "login_required", lambda: True)
    app_module.app.testing = True
    with app_module.app.test_client() as c:
        r = c.get("/api/summary?token=100.한글서명")
        assert r.status_code == 401 and r.get_json()["ok"] is False


def test_safe_equal_is_exact():
    assert auth._safe_equal("가나다", "가나다") and not auth._safe_equal("가나다", "가나라")
    assert auth._safe_equal("abc", "abc") and not auth._safe_equal("abc", "abd")


# ──────────────────────────────────────────────────────────────
# L1 — 페이지네이션: page가 이상해도 page_size는 유지
# ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("page", ["abc", "1e9", "1.5", "", "-3", "0"])
def test_bad_page_keeps_page_size(perf_client, page):
    d = perf_client.get(f"/api/performance/data?page={page}&page_size=7").get_json()
    assert len(d["data"]) == 7


def test_parse_page_args():
    parse = shared.parse_page_args
    assert parse({"page": "3", "page_size": "10"}, 200) == (3, 10)
    assert parse({"page": "abc", "page_size": "10"}, 200) == (1, 10)
    assert parse({"page": "2", "page_size": "abc"}, 200) == (2, 30)
    assert parse({"page": "2", "page_size": "0"}, 200) == (2, 30)       # 0·음수는 잘못된 값 → 기본값(예전엔 1행)
    assert parse({"page_size": "-5"}, 200) == (1, 30)
    assert parse({"page_size": "99999"}, 200) == (1, 200)
    assert parse({"page_size": "99999"}, 5000) == (1, 5000)
    assert parse({}, 200) == (1, 30)


def test_huge_page_returns_empty_page(perf_client):
    d = perf_client.get(f"/api/performance/data?page={10 ** 30}").get_json()
    assert d["data"] == [] and d["total"] > 0


def test_finance_and_kpi_pagination_keep_page_size(fin_client, kpi_client):
    assert len(fin_client.get("/api/data?page=abc&page_size=1").get_json()["data"]) == 1
    assert len(kpi_client.get("/api/kpi/data?page=abc&page_size=1").get_json()["data"]) == 1


# ──────────────────────────────────────────────────────────────
# L3·L4·L5·L6 — 오류 형식, 정보 노출, 빈 문자열, 다운로드
# ──────────────────────────────────────────────────────────────

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(auth, "is_logged_in", lambda req=None: True)
    monkeypatch.setattr(auth, "is_admin", lambda req=None: True)
    app_module.app.testing = True
    with app_module.app.test_client() as c:
        yield c


def test_download_unknown_key_does_not_echo_input(client):
    r = client.get("/api/download/<script>alert(1)</script>")
    assert r.status_code == 404
    body = r.get_json()
    assert body["ok"] is False and "script" not in body["error"]
    r = client.get("/api/download/zzzz")
    assert r.status_code == 404 and r.get_json()["ok"] is False and "zzzz" not in r.get_json()["error"]


def test_download_missing_file_has_ok_false(client, monkeypatch, tmp_path):
    monkeypatch.setitem(downloads._FILES["finance"], "resolve", lambda: str(tmp_path / "없음.xlsx"))
    r = client.get("/api/download/finance")
    assert r.status_code == 404 and r.get_json()["ok"] is False and r.get_json()["error"]


def test_project_detail_download_ignores_query_filters(client, perf_df, monkeypatch, tmp_path):
    """주석·목록 설명대로 필터 없는 전체 — 쿼리를 붙여도 적용되지 않음(주석과 동작을 맞춤)"""
    df, _, _ = perf_df
    marker = tmp_path / "perf.xlsx"
    marker.write_bytes(b"x")
    monkeypatch.setitem(downloads._FILES["project_detail"], "resolve", lambda: str(marker))
    monkeypatch.setattr(P, "get_perf_df", lambda view="actual": df)
    monkeypatch.setattr(P, "_perf_current_month", 9)
    monkeypatch.setattr(finance, "get_df", lambda: finance._empty_df())

    def n_rows(path):
        ws = load_workbook(io.BytesIO(client.get(path).data)).active
        return sum(1 for r in range(6, ws.max_row + 1) if ws.cell(r, 2).value)

    full = n_rows("/api/download/project_detail")
    assert full == N_PAIRS
    assert n_rows("/api/download/project_detail?part=파트가&search=zzz") == full
    assert n_rows("/api/performance/data/export?part=파트가") < full      # 표의 엑셀은 그대로 필터됨


def test_api_errors_are_json_without_internals(client, monkeypatch):
    r = client.get("/api/존재하지-않는-주소")
    assert r.status_code == 404 and r.is_json and r.get_json()["ok"] is False
    r = client.post("/api/summary")                          # 허용되지 않는 메서드
    assert r.status_code == 405 and r.get_json()["ok"] is False and "GET" in r.headers.get("Allow", "")

    def boom():
        raise RuntimeError(r"C:\secret\path\file.xlsx 를 못 읽음")
    monkeypatch.setattr(finance, "get_df", boom)
    r = client.get("/api/summary")
    assert r.status_code == 500 and r.is_json
    body = r.get_json()
    assert body["ok"] is False and "secret" not in json.dumps(body, ensure_ascii=False)
    assert "Traceback" not in r.get_data(as_text=True)


def test_non_api_paths_keep_default_error_pages(client):
    r = client.get("/존재하지-않는-페이지")
    assert r.status_code == 404 and not r.is_json


def test_extract_coverage_403_uses_same_wording_as_other_admin_apis(monkeypatch):
    monkeypatch.setattr(auth, "is_logged_in", lambda req=None: True)
    monkeypatch.setattr(app_module, "is_admin", lambda req=None: False)
    monkeypatch.setattr(auth, "is_admin", lambda req=None: False)
    app_module.app.testing = True
    with app_module.app.test_client() as c:
        cov = c.get("/api/extract/coverage")
        other = c.get("/api/performance/fin-mismatch")
    assert cov.status_code == other.status_code == 403
    assert cov.get_json()["error"] == other.get_json()["error"] == "관리자만 볼 수 있습니다"


def test_kpi_failure_message_is_generic(kpi_client, monkeypatch):
    def boom(*a, **k):
        raise KeyError("내부열이름_PJ실적")
    monkeypatch.setattr(kpi, "_aggregate_kpi_col", boom)
    body = kpi_client.get("/api/kpi/summary").get_json()
    assert body["available"] is False and "내부열이름" not in body["message"]


def test_finance_empty_note_is_empty_string_not_null(tmp_path, monkeypatch):
    rows = [["E001", "2024", "AI파트", "완료", 100e6, 80e6, 50e6, 20e6, 10e6, 20e6, 20.0, None, "r1.pptx", "2024-01-01", "2024-01-05", None],
            ["E002", "2024", "SW파트", "착수", 1, 1, 1, 1, 1, 1, 1.0, "메모", "r2.pptx", "2024-01-01", "2024-01-05", ""]]
    path = tmp_path / "fin.xlsx"
    pd.DataFrame(rows, columns=finance.EXCEL_COLS).to_excel(path, sheet_name="취합", index=False, engine="openpyxl")
    monkeypatch.setattr(finance, "EXCEL_PATH", str(path))
    df = finance.load_excel()
    assert df.loc[df["project_code"] == "E001", "note"].iloc[0] == ""
    assert df.loc[df["project_code"] == "E001", "missed_bid_reason"].iloc[0] == ""
    app = Flask(__name__)
    app.register_blueprint(finance.finance_bp)
    data = {r["project_code"]: r for r in app.test_client().get("/api/data").get_json()["data"]}
    assert data["E001"]["note"] == "" and data["E001"]["missed_bid_reason"] == ""
    assert data["E002"]["note"] == "메모"
