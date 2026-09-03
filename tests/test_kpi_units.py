import pandas as pd
import pytest

from app import app as flask_app
from kpi import _safe_num, _parse_new_old_count, _parse_col_num, apply_kpi_filters


class TestSafeNum:
    def test_parses_numeric_string(self):
        assert _safe_num("42") == 42.0

    def test_returns_zero_for_non_numeric(self):
        assert _safe_num("abc") == 0.0

    def test_returns_zero_for_none(self):
        assert _safe_num(None) == 0.0

    def test_returns_zero_for_infinite(self):
        assert _safe_num(float("inf")) == 0.0

    def test_returns_zero_for_nan(self):
        assert _safe_num(float("nan")) == 0.0


class TestParseNewOldCount:
    def test_parses_both_counts(self):
        assert _parse_new_old_count("신규:3건/기존:5건") == (3, 5)

    def test_missing_new_defaults_to_zero(self):
        assert _parse_new_old_count("기존:5건") == (0, 5)

    def test_missing_old_defaults_to_zero(self):
        assert _parse_new_old_count("신규:3건") == (3, 0)

    def test_unparseable_value_returns_zero_zero(self):
        assert _parse_new_old_count("N/A") == (0, 0)

    def test_handles_non_string_input(self):
        assert _parse_new_old_count(None) == (0, 0)


class TestParseColNum:
    def test_parses_plain_number_string(self):
        assert _parse_col_num("42.5") == 42.5

    def test_strips_commas(self):
        assert _parse_col_num("1,234") == 1234.0

    def test_strips_non_numeric_characters(self):
        assert _parse_col_num("약 12점") == 12.0

    def test_returns_none_when_nothing_numeric_left(self):
        assert _parse_col_num("N/A") is None

    def test_returns_none_for_empty_string(self):
        assert _parse_col_num("") is None

    def test_handles_negative_numbers(self):
        assert _parse_col_num("-5.5") == -5.5


class TestApplyKpiFilters:
    @pytest.fixture
    def sample_df(self):
        return pd.DataFrame({
            "수행연도": ["2024", "2024", "2025"],
            "파트명":   ["AI파트", "SW파트", "AI파트"],
            "보고단계": ["완료", "완료", "제안"],
        })

    def test_no_filters_returns_all_rows(self, sample_df):
        with flask_app.test_request_context("/"):
            result = apply_kpi_filters(sample_df)
        assert len(result) == 3

    def test_filters_by_year(self, sample_df):
        with flask_app.test_request_context("/?year=2024"):
            result = apply_kpi_filters(sample_df)
        assert len(result) == 2
        assert set(result["수행연도"]) == {"2024"}

    def test_filters_by_part_and_stage_combined(self, sample_df):
        with flask_app.test_request_context("/?part=AI파트&stage=완료"):
            result = apply_kpi_filters(sample_df)
        assert len(result) == 1
        assert result.iloc[0]["파트명"] == "AI파트"
        assert result.iloc[0]["보고단계"] == "완료"
