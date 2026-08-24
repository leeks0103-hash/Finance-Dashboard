import pandas as pd
import pytest

from app import app as flask_app
from performance import _resolve_perf_sheet, apply_perf_filters, _bil_perf


class TestResolvePerfSheet:
    def test_picks_the_latest_year_month(self):
        sheets = ["2025년 (12월 집계)", "2026년 (3월 집계)", "2026년 (1월 집계)"]
        assert _resolve_perf_sheet(sheets) == "2026년 (3월 집계)"

    def test_prefers_집계_over_추정_for_the_latest_period(self):
        sheets = ["2026년 (5월 추정)", "2026년 (5월 집계)"]
        assert _resolve_perf_sheet(sheets) == "2026년 (5월 집계)"

    def test_falls_back_to_추정_when_집계_missing_for_latest_period(self):
        sheets = ["2026년 (4월 집계)", "2026년 (5월 추정)"]
        assert _resolve_perf_sheet(sheets) == "2026년 (5월 추정)"

    def test_ignores_sheets_not_matching_the_pattern(self):
        sheets = ["Sheet1", "메모", "2026년 (2월 집계)"]
        assert _resolve_perf_sheet(sheets) == "2026년 (2월 집계)"

    def test_raises_when_no_sheet_matches(self):
        with pytest.raises(ValueError):
            _resolve_perf_sheet(["Sheet1", "메모"])


class TestApplyPerfFilters:
    @pytest.fixture
    def sample_df(self):
        return pd.DataFrame({
            "part": ["① AI・DS", "② SW", "① AI・DS"],
            "team": ["팀A", "팀B", "팀B"],
        })

    def test_strips_circled_number_prefix_before_matching(self, sample_df):
        # 필터 파라미터는 접두어 없는 이름으로 오므로, 매칭 전에 '① ' 같은 접두어를 제거해야 함
        with flask_app.test_request_context("/?part=AI・DS"):
            result = apply_perf_filters(sample_df)
        assert len(result) == 2

    def test_filters_by_team(self, sample_df):
        with flask_app.test_request_context("/?team=팀B"):
            result = apply_perf_filters(sample_df)
        assert len(result) == 2
        assert set(result["team"]) == {"팀B"}

    def test_combines_part_and_team_filters(self, sample_df):
        with flask_app.test_request_context("/?part=AI・DS&team=팀B"):
            result = apply_perf_filters(sample_df)
        assert len(result) == 1
        assert result.iloc[0]["team"] == "팀B"


class TestBilPerf:
    def test_converts_천원_to_억원_string(self):
        assert _bil_perf(150_000) == "1.5억원"

    def test_negative_zero_normalized(self):
        assert _bil_perf(-4_000) == "0.0억원"
