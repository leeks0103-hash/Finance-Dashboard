import os
import re

_PLACEHOLDER_CODE_RE = re.compile(r"예정|미정|생성|추진|신규")


def is_ranked_valid_code(code: str) -> bool:
    """이익율 상위/저수익 랭킹 전용 — 임시·미배정 코드 제외."""
    c = str(code).strip()
    if not c or c == "0":
        return False
    if c.isdigit():
        return False
    if _PLACEHOLDER_CODE_RE.search(c):
        return False
    return True


_STAGE_SUFFIXES = ["사전검토", "착수", "중간", "완료", "제안"]


def strip_stage_suffix(filename: str) -> str:
    """
    파일명에서 착수/완료/제안 등 보고단계 표시(및 "_수정"/"_최종"/"보고" 같은 흔한 꼬리)를 제거해,
    같은 프로젝트가 단계별로 다시 보고된 파일인지 판별하는 기준명을 만든다.
    완전한 판별은 아니고 휴리스틱 — extract_kpi_ppt.py(추출 시 placeholder 코드 충돌 방지)와
    kpi.py(대시보드 집계 시 dedup 키)가 동일 기준을 쓰도록 여기서 공유한다.
    """
    name = os.path.splitext(str(filename or ""))[0]
    for suf in _STAGE_SUFFIXES:
        name = re.sub(rf"[_\[\(]?{re.escape(suf)}[\]\)]?(_수정|_최종|보고)?$", "", name).strip()
    return name
