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
