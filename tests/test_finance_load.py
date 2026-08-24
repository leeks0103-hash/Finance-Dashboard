import finance
from tests.fixtures_data import SAMPLE_FINANCE_ROWS as ROWS


def test_load_excel_filters_blank_project_code(load_finance_fixture):
    df = load_finance_fixture(ROWS)
    assert "" not in df["project_code"].tolist()
    assert set(df["project_code"]) == {"E001", "E002", "E003", "E005", "E006"}


def test_profit_rate_corrected_when_revenue_positive(load_finance_fixture):
    df = load_finance_fixture(ROWS)
    row = df[df["project_code"] == "E002"].iloc[0]
    assert row["profit_rate"] == 20.0


def test_profit_rate_zeroed_when_no_revenue(load_finance_fixture):
    df = load_finance_fixture(ROWS)
    row = df[df["project_code"] == "E003"].iloc[0]
    assert row["profit_rate"] == 0


def test_correction_count_tracks_only_bad_rows(load_finance_fixture):
    load_finance_fixture(ROWS)
    # E002, E003 두 행만 profit_rate 이상치(>200) 보정 대상
    assert finance._last_correction_count == 2


def test_normal_row_untouched_by_correction(load_finance_fixture):
    df = load_finance_fixture(ROWS)
    row = df[df["project_code"] == "E001"].iloc[0]
    assert row["profit_rate"] == 20.0


def test_comma_and_percent_strings_parsed_as_numbers(load_finance_fixture):
    df = load_finance_fixture(ROWS)
    row = df[df["project_code"] == "E005"].iloc[0]
    assert row["revenue"] == 1_000_000
    assert row["expenditure"] == 800_000
    assert row["profit_rate"] == 20.0


def test_year_and_part_fallback_extraction_from_filename(load_finance_fixture):
    df = load_finance_fixture(ROWS)
    row = df[df["project_code"] == "E006"].iloc[0]
    assert row["year"] == "2024"
    assert row["part"] == "AI파트"
