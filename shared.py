import logging
import os
import re

logger = logging.getLogger(__name__)

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


# 파트명 앞 원문자(①~⑳) — 프론트 stripPartPrefix와 동일 범위
PART_PREFIX_RE = re.compile(r"^[①-⑳]\s*")


def strip_part_prefix(part) -> str:
    return PART_PREFIX_RE.sub("", str(part)).strip()


def safe_mtime(path):
    """파일 수정시각 — 없거나 못 읽으면 None (mtime 캐시 비교용)."""
    try:
        return os.path.getmtime(path)
    except OSError:
        return None


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
        # 수정/최종 표시가 "_수정"(언더바)뿐 아니라 "(수정)"(괄호, 언더바 없이 단계어에 바로 붙는
        # 흔한 컨벤션)으로도 나와서 후자를 놓치면 같은 프로젝트의 재보고본을 "다른 파일"로
        # 오판해 코드충돌로 잘못 기록함(예: "..._착수" vs "..._완료(수정)") — 2026-09-18 발견
        name = re.sub(
            rf"[_\[\(]?{re.escape(suf)}[\]\)]?(_수정|_최종|보고|\(수정\)|\(최종\))?$", "", name,
        ).strip()
    # 언더바/공백 표기 흔들림 정규화 — 같은 프로젝트인데 PPT 파일명에 "매치업_제조AX"처럼
    # 언더바를 쓰기도 하고 "매치업 제조AX"처럼 띄어쓰기를 쓰기도 해서, 보고단계만 떼고 봐도
    # 여전히 다른 문자열로 남아 코드충돌 오탐이 나던 케이스(2026-09-18 발견). 언더바 하나
    # 차이로만 갈리는 두 파일이 실제로 무관한 프로젝트일 가능성은 낮아 안전한 정규화로 판단.
    return re.sub(r"[ _]+", " ", name).strip()


def _heal_gen_py_cache() -> None:
    r"""%TEMP%\gen_py(pywin32 COM 형식정보 캐시) 안에서 만들다 끊겨 비어버린 폴더만 골라 지운다.

    이런 폴더가 남으면 DispatchEx·Workbooks.Open 등이 매번 "has no attribute 'CLSIDToClassMap'"으로
    실패한다(2026-09-28 실제 발생 — 재무·KPI 암호화 우회와 코드충돌 시트 읽기가 전부 조용히 죽어 있었음).
    캐시라 지우면 pywin32가 필요할 때 다시 생성함 — 정상 폴더(__init__.py 있음)는 건드리지 않음.
    """
    import shutil
    try:
        import win32com
        root = win32com.__gen_path__
        if not os.path.isdir(root):
            return
        for name in os.listdir(root):
            path = os.path.join(root, name)
            if os.path.isdir(path) and not os.path.exists(os.path.join(path, "__init__.py")):
                shutil.rmtree(path, ignore_errors=True)
                logger.warning("깨진 win32com gen_py 캐시 제거: %s", path)
    except Exception as e:
        logger.warning("gen_py 캐시 점검 실패(무시하고 진행): %s", e)


def new_excel_app():
    """AIP 암호화 엑셀 우회용 — 새 Excel 인스턴스를 COM으로 띄워 반환(호출 전 CoInitialize 필요).
    띄우기 전에 깨진 gen_py 캐시를 정리한다(_heal_gen_py_cache 참고)."""
    import win32com.client
    _heal_gen_py_cache()
    return win32com.client.DispatchEx("Excel.Application")


def read_excel_via_com(path: str, sheet_name: str) -> "pd.DataFrame | None":
    """AIP 암호화 Excel을 win32com으로 열어 DataFrame으로 반환(첫 행 = 헤더)."""
    import pandas as pd
    try:
        import pythoncom
        import win32com.client
    except ImportError:
        logger.error("win32com 없음 — pip install pywin32 필요")
        return None

    xl_app = None
    wb_com = None
    try:
        pythoncom.CoInitialize()
        xl_app = new_excel_app()   # 깨진 gen_py 캐시 자가 복구 후 DispatchEx — shared.new_excel_app 참고
        xl_app.Visible = False
        xl_app.DisplayAlerts = False

        abs_path = os.path.abspath(path)
        wb_com = xl_app.Workbooks.Open(
            abs_path,
            UpdateLinks=False,
            ReadOnly=True,
            IgnoreReadOnlyRecommended=True,
        )

        ws = None
        for i in range(1, wb_com.Sheets.Count + 1):
            if wb_com.Sheets(i).Name == sheet_name:
                ws = wb_com.Sheets(i)
                break
        if ws is None:
            logger.error("시트 없음: %s", sheet_name)
            return None

        used   = ws.UsedRange
        values = used.Value2
        if not values:
            return None
        if not isinstance(values[0], tuple):
            values = [values]

        headers = [str(v) if v is not None else "" for v in values[0]]
        rows    = [list(r) for r in values[1:]]
        df = pd.DataFrame(rows, columns=headers)
        logger.info("win32com Excel 읽기 완료: %d행 %d열", len(df), len(df.columns))
        return df

    except Exception as e:
        logger.error("read_excel_via_com 실패: %s", e)
        return None
    finally:
        try:
            if wb_com is not None:
                wb_com.Close(False)
        except Exception:
            pass
        try:
            if xl_app is not None:
                xl_app.Quit()
        except Exception:
            pass
        try:
            pythoncom.CoUninitialize()
        except Exception:
            pass


# (경로, 시트) → (mtime, DataFrame). COM 우회는 수 초 걸려서 파일이 안 바뀌었으면 재사용
_sheet_cache: dict = {}


def read_sheet_cached(path: str, sheet_name: str):
    """엑셀 시트를 DataFrame(첫 행 = 헤더)으로 — 평문이면 openpyxl, AIP 암호화면 Excel COM 우회.
    파일 mtime이 같으면 캐시 재사용. 읽기 실패면 None.

    처리이력 시트로 원본 PPT 경로를 찾는 "파일 바로가기"가 openpyxl만 써서, 출력 xlsx에 AIP가 붙는
    순간 전부 "원본 위치를 찾을 수 없습니다"가 되던 문제(2026-09-29 발견) 때문에 공용화."""
    import pandas as pd
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return None
    key = (path, sheet_name)
    hit = _sheet_cache.get(key)
    if hit and hit[0] == mtime:
        return hit[1]
    try:
        df = pd.read_excel(path, sheet_name=sheet_name, header=0, engine="openpyxl")
    except Exception as e:
        logger.warning("시트 openpyxl 읽기 실패(AIP 암호화 추정) — Excel COM으로 재시도: %s[%s] (%s)", path, sheet_name, e)
        df = read_excel_via_com(path, sheet_name)
    if df is not None:
        _sheet_cache[key] = (mtime, df)
    return df


def find_source_path(excel_path: str, sheet_name: str, filename: str) -> "str | None":
    """추출 결과 xlsx의 처리이력 시트에서 파일명으로 원본 PPT 전체경로를 찾는다(재무·KPI 공용).
    같은 파일명이 여러 번 재처리됐으면 가장 최근(처리일시 최대) 걸 사용."""
    if not filename or not os.path.exists(excel_path):
        return None
    hist = read_sheet_cached(excel_path, sheet_name)
    if hist is None:
        logger.warning("처리이력 시트 읽기 실패: %s[%s]", excel_path, sheet_name)
        return None
    matches = hist[hist["파일명"] == filename]
    if matches.empty:
        return None
    path = str(matches.sort_values("처리일시").iloc[-1]["전체경로"]).strip()
    return path or None


def is_drm_file(path: str) -> bool:
    """SoftCamp DRM(머리 'SCDSA') 파일인지 — 앞 8바이트만 읽음.
    이런 파일은 이 PC의 PowerPoint로 여는 순간 DRM이 NAS 원본을 제자리 재암호화했고(2026-09-23, 모비우스 등),
    그 뒤로 추출도 계속 실패함 → 대시보드에서 아예 안 열게 막는다(2026-10-01 요청)"""
    try:
        with open(path, "rb") as f:
            return f.read(8).startswith(b"SCDSA")
    except OSError:
        return False


def local_copy_if_drm(path: str) -> "str | None":
    """DRM(SCDSA) 파일이면 로컬 임시 폴더로 복사해 그 경로를 돌려줌(아니면 None) — 추출 스크립트용.
    NAS 원본을 PowerPoint로 직접 열면 DRM이 원본을 제자리 재암호화했으므로(2026-09-23),
    원본은 읽기(복사)만 하고 PowerPoint는 로컬 사본만 연다. 사본 삭제는 호출하는 쪽에서.
    누군가 원본을 고쳤을 수도 있어 '실패 파일 다시 추출'에서 DRM 파일도 시도는 해본다(2026-10-01 요청)"""
    if not is_drm_file(path):
        return None
    import shutil
    import tempfile
    fd, tmp = tempfile.mkstemp(suffix=os.path.splitext(path)[1] or ".pptx", prefix="drm_copy_")
    os.close(fd)
    shutil.copyfile(path, tmp)  # 내용만 복사 — 원본 메타데이터는 건드리지 않음
    return tmp


def open_source_file(path: "str | None", check_only: bool = False) -> "tuple[dict, int]":
    """원본 파일을 서버 PC에서 연다 — (응답 dict, HTTP 상태)를 돌려주고 jsonify는 라우트에서.
    한 대의 PC(호스트)를 여러 사람이 공유해서 보는 구조라, 누군가 이미 열어둔 파일은 막는다
    (닫혔는지는 잠금파일이 사라졌는지로 자동 판단 — is_file_locked 참고).
    check_only=True면 열지 않고 "열 수 있는지"만 — 프론트가 열람 중이면 안내, 아니면 "진짜 열까요?"
    확인창을 띄운 뒤 다시 호출한다(2026-09-30). 응답의 checked=True로 확인만 했음을 알림.
    DRM 파일은 check 단계부터 거절(blocked=True) — 확인창 없이 바로 "열 수 없는 파일" 안내."""
    if not path or not os.path.exists(path):
        return {"ok": False, "message": "원본 위치를 찾을 수 없습니다 — 폴더가 이동했거나 재추출이 필요할 수 있습니다."}, 404
    if is_drm_file(path):
        logger.warning("DRM 파일 열기 차단: %s", path)
        return {"ok": False, "blocked": True,
                "message": "문서보안(DRM) 암호화 파일이라 대시보드에서 열 수 없습니다.\n원본 담당자에게 확인해주세요."}, 403
    if is_file_locked(path):
        return {"ok": False, "locked": True, "message": "다른 사람이 열람 중인 파일입니다 — 닫힌 뒤 다시 시도해주세요."}, 409
    if check_only:
        return {"ok": True, "checked": True}, 200
    try:
        os.startfile(path)
    except Exception as e:
        logger.error("파일 열기 실패(%s): %s", path, e)
        return {"ok": False, "message": f"파일 실행 실패: {e}"}, 500
    return {"ok": True}, 200


def sort_frame(df, sort_by: str, sort_dir: str, empty_values=()):
    """서버 페이지네이션 표의 정렬 — 페이지를 자르기 **전에** 전체 행 기준으로 정렬(2026-10-02).

    예전엔 받아 온 한 페이지 안에서만 정렬돼 "전체 기준 정렬"이 안 됐음. sort_by가 없거나 모르는 컬럼이면 그대로.
    - 값 대부분이 숫자로 읽히면 숫자로 정렬(KPI처럼 "62"·"N"이 섞인 칸도 숫자 순), 아니면 문자열(대소문자 무시)
    - 빈 값(NaN·빈 문자열·숫자 칸의 비숫자)은 방향과 상관없이 항상 맨 뒤, 같은 값끼리는 원래 순서 유지(안정 정렬)
    - empty_values: 빈 값으로 볼 표기 추가(KPI는 화면에 "N"으로 보이는 미입력 표기)
    """
    import pandas as pd
    if not sort_by or sort_by not in df.columns or df.empty:
        return df
    asc = str(sort_dir).lower() != "desc"
    col = df[sort_by]
    text = col.astype(str).str.strip()
    present = col.notna() & (text != "") & ~text.isin(list(empty_values))
    num = pd.to_numeric(col.where(present), errors="coerce")
    if present.any() and num.notna().sum() >= present.sum() / 2:
        key = num
    else:
        key = text.str.lower().where(present, None)
    order = key.sort_values(ascending=asc, na_position="last", kind="mergesort").index
    return df.loc[order]
