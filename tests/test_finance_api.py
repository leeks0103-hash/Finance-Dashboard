from tests.fixtures_data import SAMPLE_FINANCE_ROWS as ROWS


def test_api_data_filters_by_part(client, load_finance_fixture):
    load_finance_fixture(ROWS)
    resp = client.get("/api/data?part=AI파트")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["total"] == 3
    assert {r["project_code"] for r in body["data"]} == {"E001", "E005", "E006"}


def test_api_data_search_matches_project_code(client, load_finance_fixture):
    load_finance_fixture(ROWS)
    resp = client.get("/api/data?search=E002")
    body = resp.get_json()
    assert body["total"] == 1
    assert body["data"][0]["project_code"] == "E002"


def test_api_data_excludes_blank_code_row(client, load_finance_fixture):
    load_finance_fixture(ROWS)
    resp = client.get("/api/data")
    body = resp.get_json()
    assert body["total"] == 5
    assert "" not in [r["project_code"] for r in body["data"]]


def test_api_summary_totals_and_correction_applied(client, load_finance_fixture):
    load_finance_fixture(ROWS)
    resp = client.get("/api/summary")
    body = resp.get_json()
    assert body["count"] == 5
    assert body["total_revenue"] == 101_000_110
    assert set(body["by_part"].keys()) == {"AI파트", "SW파트", "PM파트"}


def test_api_summary_respects_part_filter(client, load_finance_fixture):
    load_finance_fixture(ROWS)
    resp = client.get("/api/summary?part=AI파트")
    body = resp.get_json()
    assert body["count"] == 3


def test_api_summary_empty_dataset_returns_zeroed_shape(client, load_finance_fixture):
    load_finance_fixture(ROWS)
    resp = client.get("/api/summary?year=1999")
    body = resp.get_json()
    assert body["count"] == 0
    assert body["total_revenue"] == 0
    assert body["by_part"] == {}


def test_api_reload_reports_ok_count_and_corrected_rows(client, make_finance_excel, monkeypatch):
    import finance
    path = make_finance_excel(ROWS)
    monkeypatch.setattr(finance, "EXCEL_PATH", path)

    resp = client.post("/api/reload")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["ok"] is True
    assert body["count"] == 5
    assert body["corrected_rows"] == 2
