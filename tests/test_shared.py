import pytest

from shared import is_ranked_valid_code


@pytest.mark.parametrize("code", ["E12345", "AI-2024-001", "P001"])
def test_valid_codes_pass(code):
    assert is_ranked_valid_code(code) is True


@pytest.mark.parametrize("code", ["", "0", "  "])
def test_empty_or_zero_codes_rejected(code):
    assert is_ranked_valid_code(code) is False


def test_pure_digit_codes_rejected():
    # 숫자로만 된 코드는 임시/미배정 코드로 취급
    assert is_ranked_valid_code("12345") is False


@pytest.mark.parametrize("code", ["예정", "미정코드", "생성중", "추진예정1", "신규프로젝트"])
def test_placeholder_keyword_codes_rejected(code):
    assert is_ranked_valid_code(code) is False


def test_code_with_surrounding_whitespace_is_trimmed():
    assert is_ranked_valid_code("  E999  ") is True
