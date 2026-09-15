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


def is_file_locked(path: str) -> bool:
    """Office가 파일을 편집 모드로 열어둔 동안 같은 폴더에 남기는 숨김 잠금파일(~$파일명)이
    있는지 확인 — 대시보드 "파일 열기"가 os.startfile()로 여는 건 항상 일반(읽기/쓰기) 열기라
    이 잠금파일이 생긴다. 추출 스크립트의 win32com ReadOnly 자동화 열기는 보통 이 잠금파일을
    남기지 않아(닫으면 즉시 사라짐) 정상적인 재추출 중에는 오탐이 거의 없다.
    한 대의 PC(호스트)를 여러 사람이 공유해서 보는 구조라, 이미 열려있는 파일을 "파일 열기"
    버튼으로 다시 열려는 걸 막을 때 이 여부만 확인하면 된다 — 닫혔는지는 잠금파일이 사라졌는지로
    판단하면 되므로 "언제 껐는지"를 따로 추적할 필요가 없다."""
    directory = os.path.dirname(path)
    lock_name = "~$" + os.path.basename(path)
    return os.path.exists(os.path.join(directory, lock_name))


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
