import pandas as pd
import pytest

import app as app_module
import headcount
import performance


@pytest.fixture
def hc_path(tmp_path, monkeypatch):
    path = tmp_path / "headcount.json"
    monkeypatch.setattr(headcount, "HEADCOUNT_PATH", path)
    return path


@pytest.fixture
def as_admin(monkeypatch):
    # app.py는 current_admin을 이름으로 가져와 쓰므로 app 쪽을 바꿔 끼움
    monkeypatch.setattr(app_module, "current_admin", lambda req=None: {"emp_no": "E1", "name": "관리자", "role": "admin"})


class TestValidateParts:
    def test_strips_prefix_and_accepts_whole_numbers(self):
        parts, err = headcount.validate_parts({"① AIㆍDS": "12", "SW": 7.0})
        assert err is None
        assert parts == {"AIㆍDS": 12, "SW": 7}

    def test_blank_and_zero_mean_not_entered(self):
        parts, err = headcount.validate_parts({"AIㆍDS": "", "SW": 0, "EM": None, "PM": 3})
        assert err is None
        assert parts == {"PM": 3}

    @pytest.mark.parametrize("bad", [-1, 1000, "abc", True, [1], 7.5, "0.5"])
    def test_rejects_invalid_numbers(self, bad):
        _, err = headcount.validate_parts({"AIㆍDS": bad})
        assert err

    def test_rejects_non_object(self):
        assert headcount.validate_parts([1, 2])[1]


class TestPerHead:
    def test_none_without_headcount(self):
        assert headcount.per_head(1000, None) is None
        assert headcount.per_head(1000, 0) is None

    def test_divides(self):
        assert headcount.per_head(1000, 4) == 250

    def test_fields_use_plan_only_for_revenue(self):
        f = headcount.per_head_fields(
            {"plan_initial": 600, "jun_check_total": 800, "operating_profit": 40, "cost_mgmt": 80}, 4, 5)
        # 계획 매출은 계획 인원(5명), 나머지는 현재 인원(4명)으로 나눔
        assert f["rev_per_head_plan"] == 120 and f["rev_per_head_est"] == 200
        assert f["profit_per_head"] == 10 and f["mgmt_per_head"] == 20
        assert f["headcount"] == 4 and f["plan_headcount"] == 5

    def test_plan_revenue_blank_without_plan_headcount(self):
        f = headcount.per_head_fields({"plan_initial": 600, "jun_check_total": 800}, 4)
        assert f["rev_per_head_plan"] is None and f["rev_per_head_est"] == 200


class TestHeadcountApi:
    def test_get_defaults_when_file_missing(self, client, hc_path):
        body = client.get("/api/settings/headcount").get_json()
        assert body["parts"] == {} and body["plan_parts"] == {}

    def test_put_requires_admin(self, client, hc_path, monkeypatch):
        monkeypatch.setattr(app_module, "current_admin", lambda req=None: None)
        r = client.put("/api/settings/headcount", json={"parts": {"AIㆍDS": 3}})
        assert r.status_code == 403
        assert not hc_path.exists()

    def test_put_saves_and_get_returns(self, client, hc_path, as_admin):
        r = client.put("/api/settings/headcount", json={"parts": {"① AIㆍDS": 12, "SW": ""}})
        assert r.status_code == 200
        body = r.get_json()
        assert body["parts"] == {"AIㆍDS": 12} and body["updated_by"] == "E1" and body["updated_at"]
        assert client.get("/api/settings/headcount").get_json()["parts"] == {"AIㆍDS": 12}

    def test_put_saves_plan_and_keeps_it_when_omitted(self, client, hc_path, as_admin):
        r = client.put("/api/settings/headcount", json={"parts": {"AIㆍDS": 12}, "plan_parts": {"① AIㆍDS": 15}})
        assert r.get_json()["plan_parts"] == {"AIㆍDS": 15}
        # 옛 화면처럼 plan_parts 없이 저장해도 계획 인원은 그대로
        r = client.put("/api/settings/headcount", json={"parts": {"AIㆍDS": 13}})
        assert r.get_json()["parts"] == {"AIㆍDS": 13} and r.get_json()["plan_parts"] == {"AIㆍDS": 15}

    def test_put_rejects_bad_plan_value(self, client, hc_path, as_admin):
        r = client.put("/api/settings/headcount", json={"parts": {"AIㆍDS": 1}, "plan_parts": {"AIㆍDS": 5000}})
        assert r.status_code == 400 and not hc_path.exists()

    def test_old_file_without_plan_reads_as_current_only(self, client, hc_path):
        hc_path.write_text('{"parts": {"AIㆍDS": 4}}', encoding="utf-8")
        body = client.get("/api/settings/headcount").get_json()
        assert body["parts"] == {"AIㆍDS": 4} and body["plan_parts"] == {}

    def test_put_rejects_bad_value_without_writing(self, client, hc_path, as_admin):
        r = client.put("/api/settings/headcount", json={"parts": {"AIㆍDS": -5}})
        assert r.status_code == 400 and not hc_path.exists()

    def test_corrupt_file_reads_as_empty(self, client, hc_path):
        hc_path.write_text("{not json", encoding="utf-8")
        assert client.get("/api/settings/headcount").get_json()["parts"] == {}


def _perf_df():
    base = dict(use_yn="사용", progress="진행", actual_2025=0.0, profit_gross=0.0, acc_profit_gross=0.0,
                acc_operating_profit=0.0, cost_direct=0.0, cost_labor=0.0, cost_overhead=0.0, cost_mgmt=0.0,
                jun_actual=0.0, plan_initial=0.0, jun_check_total=0.0, operating_profit=0.0, profit_rate=0.0)
    rows = [
        # (구분, 파트, 팀, 계획, 추정, 손익, 관리비)
        ("매출", "① AIㆍDS", "팀A", 600, 800, 40, 80),
        ("원가", "① AIㆍDS", "팀A", 300, 400, 0, 0),
        ("매출", "⑦ K뉴딜TF", "팀A", 100, 120, 10, 12),
        ("원가", "⑦ K뉴딜TF", "팀A", 50, 60, 0, 0),
        ("매출", "⑦ K뉴딜TF", "팀B", 200, 240, 20, 24),
        ("원가", "⑦ K뉴딜TF", "팀B", 100, 120, 0, 0),
    ]
    out = []
    for cat, part, team, plan, est, profit, mgmt in rows:
        out.append({**base, "category": cat, "part": part, "team": team, "plan_initial": plan,
                    "jun_check_total": est, "operating_profit": profit, "cost_mgmt": mgmt})
    return pd.DataFrame(out)


class TestSummaryPerCapita:
    @pytest.fixture
    def summary(self, client, hc_path, monkeypatch):
        monkeypatch.setattr(performance, "get_perf_df", _perf_df)
        headcount.HEADCOUNT_PATH.write_text(
            '{"parts": {"AIㆍDS": 4, "K뉴딜TF": 6}, "plan_parts": {"AIㆍDS": 5, "K뉴딜TF": 8}}', encoding="utf-8")

        def get(query=""):
            r = client.get("/api/performance/summary" + query)
            assert r.status_code == 200
            return r.get_json()["by_part"]
        return get

    def test_per_head_values_in_thousand_won(self, summary):
        p = summary()["① AIㆍDS"]
        assert p["headcount"] == 4 and p["plan_headcount"] == 5
        assert p["rev_per_head_plan"] == 120 and p["rev_per_head_est"] == 200
        assert p["profit_per_head"] == 10 and p["mgmt_per_head"] == 20
        assert p["headcount_partial"] is False

    def test_part_without_headcount_has_no_per_head(self, client, hc_path, monkeypatch):
        monkeypatch.setattr(performance, "get_perf_df", _perf_df)
        by_part = client.get("/api/performance/summary").get_json()["by_part"]
        assert by_part["① AIㆍDS"]["headcount"] is None
        assert by_part["① AIㆍDS"]["rev_per_head_est"] is None

    def test_multi_team_part_is_blank_when_team_filtered(self, summary):
        k = summary("?team=팀A")["⑦ K뉴딜TF"]
        assert k["headcount_partial"] is True and k["rev_per_head_est"] is None

    def test_multi_team_part_uses_headcount_when_not_filtered(self, summary):
        k = summary()["⑦ K뉴딜TF"]
        assert k["rev_per_head_est"] == pytest.approx(360 / 6)
        assert k["rev_per_head_plan"] == pytest.approx(300 / 8)
