import pytest

from shared import is_ranked_valid_code, strip_stage_suffix


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


# ── strip_stage_suffix: 같은 프로젝트의 재보고본인지 판별하는 기준명 생성 ──────

@pytest.mark.parametrize("a,b", [
    # "(수정)"처럼 괄호로 붙는 수정 표시 — 2026-09-18 발견(오탐으로 코드충돌 잘못 기록됨)
    (
        "(HMC RnD) 26년_사외시험 안전 가이드 2차 개발 프로젝트_전차_착수.pptx",
        "(HMC RnD) 26년_사외시험 안전 가이드 2차 개발 프로젝트_전차_완료(수정).pptx",
    ),
    (
        "(HMC RnD) 26년_Virtual Drive Unit 매뉴얼 및 시스템 안내 자료 개발_전차_완료.pptx",
        "(HMC RnD) 26년_Virtual Drive Unit 매뉴얼 및 시스템 안내 자료 개발_전차_완료(수정).pptx",
    ),
    # 언더바/공백 표기 흔들림 — 2026-09-18 발견
    (
        "(정부 교육부) 26년_매치업_제조AX 교육과정 개발_PM_제안.pptx",
        "(정부 교육부) 26년_매치업 제조AX 교육과정 개발_PM_착수.pptx",
    ),
])
def test_strip_stage_suffix_same_project_different_stage_or_spacing(a, b):
    assert strip_stage_suffix(a) == strip_stage_suffix(b)


@pytest.mark.parametrize("a,b", [
    # 프로젝트명 자체가 다르면 "(수정)"/언더바 정규화와 무관하게 여전히 달라야 함
    ("A프로젝트_완료.pptx", "B프로젝트_완료(수정).pptx"),
    (
        "(정부 교육부) 26년_매치업 신에너지자동차, 지능형자동차_PM_착수.pptx",
        "(정부 교육부) 26년_매치업 X-AI 교육과정 개발ㆍ운영_PM_제안.pptx",
    ),
])
def test_strip_stage_suffix_different_projects_stay_different(a, b):
    assert strip_stage_suffix(a) != strip_stage_suffix(b)
