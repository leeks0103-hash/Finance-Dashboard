import pandas as pd
import pytest

from finance import (
    _extract_year, _extract_part, _sort_stages, bil, _safe_avg_rate, _build_part_stats,
)


class TestExtractYear:
    def test_extracts_two_digit_year_from_filename(self):
        assert _extract_year("[AI파트]_24년_상반기_보고서.pptx", None) == "2024"

    def test_falls_back_to_reflected_at_when_no_year_in_filename(self):
        assert _extract_year("보고서.pptx", "2025-03-10") == "2025"

    def test_returns_literal_nan_string_when_nothing_usable(self):
        # pd.to_datetime(None) -> NaT, NaT.year -> nan -> str(nan) == "nan" (빈 문자열이 아님, 현재 동작)
        assert _extract_year("보고서.pptx", None) == "nan"


class TestExtractPart:
    def test_extracts_segment_before_the_last_underscore(self):
        # parts[-2] 규칙이므로 파트명은 반드시 파일명의 뒤에서 두 번째 '_' 구간에 있어야 함
        assert _extract_part("기술교육실_24년_AI파트_보고서.pptx") == "AI파트"

    def test_second_to_last_segment_wins_even_if_it_looks_like_a_year(self):
        # 파트명이 마지막 구간이 아니라 그 앞이면, 실제로 뽑히는 건 "24년" 쪽
        assert _extract_part("기술교육실_AI파트_24년_보고서.pptx") == "24년"

    def test_strips_brackets_from_part_segment(self):
        assert _extract_part("기술교육실_[SW파트]_보고서.pptx") == "SW파트"

    def test_4_to_6_digit_numeric_segment_treated_as_기타(self):
        # 프로젝트 코드 등 4~6자리 숫자 세그먼트가 파트명 자리에 오면 '기타' 처리
        assert _extract_part("기술교육실_202401_보고서.pptx") == "기타"

    def test_longer_numeric_segment_is_not_caught_by_기타_rule(self):
        # \d{4,6} fullmatch라 7자리 이상 숫자는 걸러지지 않고 그대로 파트명이 됨 (알려진 경계 케이스)
        assert _extract_part("기술교육실_20240001_보고서.pptx") == "20240001"

    def test_single_segment_filename_returns_기타(self):
        assert _extract_part("보고서.pptx") == "기타"


class TestSortStages:
    def test_sorts_by_fixed_priority_order(self):
        result = _sort_stages(["완료", "제안", "검토", "착수"])
        assert result == ["검토", "제안", "착수", "완료"]

    def test_unknown_stage_is_not_dropped(self):
        result = _sort_stages(["완료", "미지정단계", "검토"])
        assert set(result) == {"완료", "미지정단계", "검토"}
        # 알려진 단계 기준 순서는 유지되어야 함
        assert result.index("검토") < result.index("완료")


class TestBil:
    def test_formats_positive_won_as_억원(self):
        assert bil(1_230_000_000) == "12.3억원"

    def test_negative_zero_normalized_to_positive_zero(self):
        # -0.04억 처럼 반올림하면 -0.0억원으로 나올 수 있는 표기 오류 방지
        assert bil(-4_000_000) == "0.0억원"


class TestSafeAvgRate:
    def test_averages_only_positive_values(self):
        # 손실(음수)·0 은 평균 이익율 계산에서 제외
        assert _safe_avg_rate(pd.Series([10, 20, -5, 0])) == 15.0

    def test_returns_zero_when_no_positive_values(self):
        assert _safe_avg_rate(pd.Series([-5, 0, -10])) == 0

    def test_coerces_non_numeric_and_ignores_them(self):
        assert _safe_avg_rate(pd.Series(["10", "abc", "30"])) == 20.0


class TestBuildPartStats:
    def test_aggregates_revenue_profit_count_and_avg_rate_per_part(self):
        df = pd.DataFrame({
            "part":            ["A", "A", "B"],
            "revenue":         [100, 200, 50],
            "operating_profit": [10, 20, -5],
            "project_code":    ["P1", "P2", "P3"],
            "profit_rate":     [10.0, 10.0, -10.0],
        })
        stats = _build_part_stats(df).set_index("part")

        assert stats.loc["A", "revenue"] == 300
        assert stats.loc["A", "profit"] == 30
        assert stats.loc["A", "count"] == 2
        assert stats.loc["A", "avg_rate"] == 10.0
        # B는 손실만 있으므로 평균 이익율은 0 (음수 제외 로직)
        assert stats.loc["B", "avg_rate"] == 0
