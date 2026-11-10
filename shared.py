import json
import logging
import os
import re
import threading
import time

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


def parse_page_args(args, max_page_size: int, default_page_size: int = 30) -> "tuple[int, int]":
    """서버 페이지 표의 `page`·`page_size` 쿼리 → (page, page_size). 두 값을 따로 해석함.
    예전엔 둘을 한 try 안에서 해석해 page가 숫자가 아니면(`abc`·`1e9`·`1.5`) 멀쩡한 page_size까지 기본 30으로 되돌아갔음(2026-11-04).
    page: 숫자가 아니면 1, 1 미만은 1 / page_size: 숫자가 아니거나 1 미만(0·음수)이면 기본값, max_page_size 초과는 max로.
    (0을 1행으로 줄이는 건 의도가 아니라 우연한 clamp 결과였음 — 잘못된 값은 기본값으로 통일)
    상한은 엔드포인트마다 다름(재무 /api/data 5000, KPI·실적 200 — 원래 값 유지)"""
    try:
        page = max(1, int(args.get("page", 1)))
    except (ValueError, TypeError):
        page = 1
    try:
        size = int(args.get("page_size", default_page_size))
    except (ValueError, TypeError):
        size = default_page_size
    if size < 1:
        size = default_page_size
    return page, min(max_page_size, size)


def nonblank(values) -> list:
    """필터 쿼리 값(`getlist` 결과)에서 빈 문자열·공백뿐인 값을 뺌.
    `?part=`처럼 값이 빈 파라미터는 "필터 없음"으로 통일하기 위함 — 안 빼면 `isin([''])`이 되어 0건이 되고,
    `team=`·`progress=`(단일 값, 빈 값이면 필터 안 함)과 엔드포인트마다 뜻이 달랐음(2026-11-04)"""
    return [v for v in values if str(v).strip()]


def safe_mtime(path):
    """파일 수정시각 — 없거나 못 읽으면 None (mtime 캐시 비교용)."""
    try:
        return os.path.getmtime(path)
    except OSError:
        return None


_STAGE_SUFFIXES = ["사전검토", "착수", "중간", "완료", "제안"]


def is_file_locked(path: str) -> bool:
    """Office가 파일을 편집 모드로 열어둔 동안 같은 폴더에 남기는 숨김 잠금파일(~$파일명)이
    있는지 확인 — 대시보드 "파일 열기"(각 PC의 파일 열기 도구가 ShellExecute로 여는 건) 항상 일반(읽기/쓰기) 열기라
    이 잠금파일이 생긴다. 추출 스크립트의 win32com ReadOnly 자동화 열기는 보통 이 잠금파일을
    남기지 않아(닫으면 즉시 사라짐) 정상적인 재추출 중에는 오탐이 거의 없다.
    NAS 원본을 여러 사람이 각자 PC에서 여는 구조라, 이미 열려있는 파일을 "파일 열기"
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


# Excel COM 읽기는 한 번에 하나만 — 페이지를 열면 여러 API가 동시에 같은 암호화 파일을 각자 새 Excel로 열려다
# "Workbooks.Open 오류"가 났음(2026-11-02 로그). read_excel_via_com·ComExcelFile이 같이 씀
_com_lock = threading.RLock()


def read_excel_via_com(path: str, sheet_name: str) -> "pd.DataFrame | None":
    """AIP 암호화 Excel을 win32com으로 열어 DataFrame으로 반환(첫 행 = 헤더)."""
    with _com_lock:
        return _read_excel_via_com_locked(path, sheet_name)


def _read_excel_via_com_locked(path: str, sheet_name: str) -> "pd.DataFrame | None":
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


def is_ole2_file(path: str) -> bool:
    """엑셀이 zip(.xlsx)이 아니라 OLE2 컨테이너인지 — 회사 보안(AIP/권한관리) 암호화가 걸리면 이 형식이 됨"""
    try:
        with open(path, "rb") as f:
            return f.read(8) == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
    except OSError:
        return False


# Excel이 셀 오류(#DIV/0! 등)를 숫자 코드로 돌려주는 값 → openpyxl이 주는 글자와 같게(숫자로 읽혀 조용히 틀리는 것 방지)
_COM_ERROR_CODES = {
    -2146826281: "#DIV/0!", -2146826246: "#N/A", -2146826259: "#NAME?", -2146826288: "#NULL!",
    -2146826252: "#NUM!", -2146826265: "#REF!", -2146826273: "#VALUE!",
}

# pd.read_excel은 이 글자들을 빈 값(NaN)으로 읽음("#N/A" 셀 포함) — COM 쪽도 같게 해야 두 경로 결과가 같음(2026-11-02 대조에서 발견)
try:
    from pandas._libs.parsers import STR_NA_VALUES as _PANDAS_NA_STRINGS
except Exception:   # pandas 내부 상수 — 못 찾으면 알려진 기본값
    _PANDAS_NA_STRINGS = {"", "#N/A", "#N/A N/A", "#NA", "-1.#IND", "-1.#QNAN", "-NaN", "-nan", "1.#IND", "1.#QNAN",
                          "<NA>", "N/A", "NA", "NULL", "NaN", "None", "n/a", "nan", "null"}

# (경로, 수정시각) → {"names": 시트 이름 목록, "sheets": {시트: 값 2차원 목록}} — 같은 파일은 Excel을 한 번만 띄우도록
_com_book_cache: dict = {}


class ComExcelFile:
    """`pd.ExcelFile` 중 실적 읽기가 쓰는 부분(`sheet_names`, `parse`)만 흉내 — 암호화(OLE2) 엑셀을 Excel COM으로 읽음.
    값(Value2)만 읽고 저장·수정은 안 함(ReadOnly로 열고 Close(False)). Excel은 처음 필요할 때 한 번만 띄우고
    같은 파일(수정 시각 같음)은 캐시. 날짜 셀은 일련번호 숫자로 옴(실적 시트의 읽는 열엔 날짜 없음)."""

    def __init__(self, path: str):
        self.path = os.path.abspath(path)
        self._key = (self.path, safe_mtime(self.path))
        for k in [k for k in _com_book_cache if k[0] == self.path and k != self._key]:
            del _com_book_cache[k]   # 파일이 바뀌었으면 옛 값은 버림
        self._entry = _com_book_cache.setdefault(self._key, {"names": None, "sheets": {}})
        self._pythoncom = self._xl = self._wb = None
        self._locked = False

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def _open(self):
        if self._wb is not None:
            return
        import pythoncom
        _com_lock.acquire()
        self._locked = True
        try:
            pythoncom.CoInitialize()
            self._pythoncom = pythoncom
            self._xl = new_excel_app()
            self._xl.Visible = False
            self._xl.DisplayAlerts = False
            self._wb = self._xl.Workbooks.Open(
                self.path, UpdateLinks=False, ReadOnly=True, IgnoreReadOnlyRecommended=True,
            )
        except Exception:
            self.close()
            raise

    def close(self):
        try:
            if self._wb is not None:
                self._wb.Close(False)
        except Exception:
            pass
        try:
            if self._xl is not None:
                self._xl.Quit()
        except Exception:
            pass
        try:
            if self._pythoncom is not None:
                self._pythoncom.CoUninitialize()
        except Exception:
            pass
        self._wb = self._xl = self._pythoncom = None
        if self._locked:
            self._locked = False
            _com_lock.release()

    @property
    def sheet_names(self) -> list:
        if self._entry["names"] is None:
            self._open()
            self._entry["names"] = [self._wb.Sheets(i).Name for i in range(1, self._wb.Sheets.Count + 1)]
        return list(self._entry["names"])

    def _sheet_values(self, sheet_name: str) -> list:
        cached = self._entry["sheets"].get(sheet_name)
        if cached is not None:
            return cached
        self._open()
        ws = self._wb.Sheets(sheet_name)
        ur = ws.UsedRange
        last_r = ur.Row + ur.Rows.Count - 1
        last_c = ur.Column + ur.Columns.Count - 1
        # 시트 첫 행·첫 열(A1)부터 — pd.read_excel(header=None, skiprows=N)이 시트 1행부터 세는 것과 같은 기준
        raw = ws.Range(ws.Cells(1, 1), ws.Cells(last_r, last_c)).Value2
        if not isinstance(raw, tuple):
            raw = ((raw,),)
        rows = []
        for r in raw:
            row = []
            for v in r:
                if isinstance(v, int) and not isinstance(v, bool) and v in _COM_ERROR_CODES:
                    v = _COM_ERROR_CODES[v]
                if isinstance(v, str) and v in _PANDAS_NA_STRINGS:
                    v = None
                elif isinstance(v, float) and v.is_integer() and abs(v) < 1e15:
                    v = int(v)   # openpyxl은 정수로 저장된 셀을 int로 줌 — 코드 칸이 "123.0"이 되지 않게
                row.append(v)
            rows.append(row)
        while rows and all(v is None for v in rows[-1]):   # pandas처럼 아래쪽 빈 행 제거
            rows.pop()
        self._entry["sheets"][sheet_name] = rows
        return rows

    def parse(self, sheet_name, header=None, skiprows=0, usecols=None, nrows=None):
        import pandas as pd
        if header is not None:
            raise NotImplementedError("ComExcelFile.parse는 header=None만 지원")
        rows = self._sheet_values(sheet_name)[skiprows:]
        if nrows is not None:
            rows = rows[:nrows]
        width = max((len(r) for r in rows), default=0)
        while width > 0 and all(r[width - 1] is None for r in rows if len(r) >= width):   # pandas처럼 오른쪽 빈 열 제거
            width -= 1
        df = pd.DataFrame([(r + [None] * width)[:width] for r in rows])
        if usecols is not None:
            cols = sorted(usecols)
            for c in cols:   # 시트 끝보다 오른쪽 열은 빈 열로(pandas는 오류) — 맵 검증이 빈 열을 걸러냄
                if c not in df.columns:
                    df[c] = None
            df = df[cols]
        return df


def open_excel_file(path: str, engine: str = "openpyxl"):
    """`pd.ExcelFile` 대용 — 암호화(OLE2) 파일이면 Excel COM(`ComExcelFile`), 아니면 pandas 그대로."""
    import pandas as pd
    if is_ole2_file(path):
        return ComExcelFile(path)
    return pd.ExcelFile(path, engine=engine)


def read_sheet_frame(path: str, sheet_name: str, skiprows: int = 0, nrows: "int | None" = None, engine: str = "openpyxl"):
    """`pd.read_excel(path, sheet_name, header=None, skiprows, nrows)` 대용 — 암호화(OLE2)면 Excel COM"""
    import pandas as pd
    if is_ole2_file(path):
        with ComExcelFile(path) as xf:
            return xf.parse(sheet_name, header=None, skiprows=skiprows, nrows=nrows)
    return pd.read_excel(path, sheet_name=sheet_name, header=None, skiprows=skiprows, nrows=nrows, engine=engine)


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


def save_workbook_atomic(wb, path: str) -> None:
    """추출 중간 저장용 — 임시 파일에 먼저 쓰고 교체해서, 저장 도중 프로세스가 죽어도(제한 시간 초과 kill 등)
    결과 엑셀이 반쪽 파일로 남지 않게 함(2026-11-06). 추출은 마지막에 한 번만 저장해서 30분 제한에 걸리면
    그 실행에서 읽은 결과가 통째로 사라졌음 → 파일 N개마다 호출.
    교체가 안 되면(서버가 그 엑셀을 읽는 중 등) 직접 저장으로 대신함. 저장 자체가 실패하면 예외 그대로."""
    tmp = path + ".partial"
    try:
        wb.save(tmp)
        os.replace(tmp, path)
    except Exception:
        try:
            os.remove(tmp)
        except OSError:
            pass
        wb.save(path)


def backup_output_file(path: str, keep: int = 5, tag: str = "") -> "str | None":
    """추출 결과 엑셀을 data/backup/에 시각을 붙여 복사(최근 keep개만 남김). 실패해도 추출은 계속(None).
    예전엔 결과 엑셀이 보안 암호화(AIP)로 읽히지 않으면 스크립트가 '손상'으로 보고 지우고 새로 만들어
    그때까지 추출한 이력이 통째로 사라졌음(2026-11-02·11-06·11-10) — 실행마다 복사본을 남겨 둠(2026-11-10)."""
    import shutil
    from datetime import datetime
    try:
        if not os.path.exists(path):
            return None
        folder = os.path.join(os.path.dirname(path), "backup")
        os.makedirs(folder, exist_ok=True)
        stem, ext = os.path.splitext(os.path.basename(path))
        dest = os.path.join(folder, f"{stem}{tag}_{datetime.now():%Y%m%d_%H%M%S}{ext}")
        shutil.copy2(path, dest)
        mine = sorted((f for f in os.listdir(folder) if f.startswith(f"{stem}{tag}_") and f.endswith(ext)), reverse=True)
        for old in mine[keep:]:
            try:
                os.remove(os.path.join(folder, old))
            except OSError:
                pass
        return dest
    except Exception:   # noqa: BLE001 — 백업 실패가 추출을 막으면 안 됨
        logger.exception("추출 결과 백업 실패: %s", path)
        return None


def load_output_workbook(path: str, log, allow_recreate: bool = False):
    """추출 결과 엑셀 열기 — 있으면 (워크북, 상태), 없으면 (None, 'new').
    **열기에 실패해도 파일을 지우지 않는다.** 백업을 남기고, 보안 암호화(OLE2)면 Excel COM으로 값을 읽어 평문 워크북으로 복원
    ('recovered'). 복원도 못 하면 예외 — 추출을 멈춰 기존 이력이 빈 파일로 덮어써지는 걸 막음.
    allow_recreate=True(초기화 추출처럼 어차피 비우고 시작하는 경우)면 백업만 남기고 새로 시작('recreated').
    복원은 값만 — 서식은 호출한 쪽이 다시 입히고, 시트 이름·머리글·행은 그대로."""
    from openpyxl import Workbook, load_workbook
    if not os.path.exists(path):
        return None, "new"
    try:
        return load_workbook(path), "loaded"
    except Exception as e:   # noqa: BLE001
        reason = f"{type(e).__name__}: {e}"
    log(f"[경고] 결과 엑셀을 못 열었습니다({reason}) — 파일은 지우지 않고 백업합니다")
    bk = backup_output_file(path, keep=10, tag=".열기실패")
    if bk:
        log(f"[백업] {bk}")
    if allow_recreate:
        log("[안내] 초기화 추출이라 새 파일로 시작합니다")
        return None, "recreated"
    if is_ole2_file(path):
        try:
            wb = Workbook()
            wb.remove(wb.active)
            with ComExcelFile(path) as xf:
                for name in xf.sheet_names:
                    ws = wb.create_sheet(name)
                    for row in xf._sheet_values(name):
                        ws.append(list(row))
            log(f"[복원] 암호화된 결과 엑셀을 Excel로 읽어 평문으로 복원했습니다: 시트 {len(wb.sheetnames)}개")
            return wb, "recovered"
        except Exception as e2:   # noqa: BLE001
            reason += f" / Excel로 읽기도 실패: {type(e2).__name__}: {e2}"
    raise RuntimeError(
        f"결과 엑셀을 읽을 수 없어 추출을 중단합니다(기존 이력 보호) — {reason}. "
        f"백업: {bk or '못 만듦'}. 엑셀이 다른 곳에서 열려 있으면 닫고 다시 실행하거나, 이력을 버려도 되면 '초기화' 방식으로 추출하세요."
    )


def build_open_url(path: str, folder: bool = False) -> str:
    """접속자 PC에서 파일·폴더를 열 때 쓰는 주소 — hmcopen://f/<경로> (폴더는 d/).
    경로는 UTF-8을 base64url(= 없이)로 감싼 것 — 한글·공백이 든 NAS 경로를 주소에 안전하게 싣고 길이를 줄이려고.
    이 주소를 받아 실제로 여는 건 각 PC에 설치한 '파일 열기 도구'(tools/HmcOpen) — 도구가 허용 폴더·PPT 확장자를
    스스로 다시 검사하므로 서버가 준 주소라도 그대로 믿지 않는다."""
    import base64
    token = base64.urlsafe_b64encode(os.path.normpath(path).encode("utf-8")).decode("ascii").rstrip("=")
    return f"hmcopen://{'d' if folder else 'f'}/{token}"


# ── 파일 열람 기록·경고(2026-11-06) ───────────────────────────────────────────────
# 서버는 파일이 "닫혔는지" 알 수 없다 — 그래서 막지 않고, 열 때 "N분 전 ○○님이 열었습니다" 경고(확인창)만 보여 준다.
# 기록은 대시보드로 연 것만(열기 주소를 내준 시각 기준 — 브라우저 허용 창에서 취소했어도 남는 한계 있음).
# 경고는 OPEN_NOTICE_SEC(30분) 안의 기록에만 — 지나면 기록 기반 경고는 없음. 잠금파일(~$)만 있고 기록이 없으면 "누군가 열고 있는 듯"만 알림.
# 어느 경우든 열기는 막지 않는다(남은 잠금파일에 영영 막히던 문제 해결). DRM 차단만 그대로.
OPEN_NOTICE_SEC = 30 * 60
OPEN_HISTORY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "open_history.json")
_open_lock = threading.Lock()


def _open_key(path: str) -> str:
    return os.path.normcase(os.path.normpath(path))


def _load_open_history() -> dict:
    try:
        with open(OPEN_HISTORY_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


_roster_cache: "tuple[str, float, dict[str, str]] | None" = None


def _roster_names() -> "dict[str, str]":
    """사번 → 이름 — 로그인 계정(.env)엔 사번만 있어서 시크릿 키 메일 명단 엑셀에서 가져옴(수정 시각이 바뀔 때만 다시 읽음).
    명단을 못 읽으면 빈 dict(이름 대신 사번이 보임)"""
    global _roster_cache
    try:
        import secret_mail
        path = secret_mail.latest_roster_path()
        if not path:
            return {}
        mtime = os.path.getmtime(path)
        if _roster_cache and _roster_cache[0] == path and _roster_cache[1] == mtime:
            return _roster_cache[2]
        names = {r["emp"]: r["name"] for r in secret_mail.read_roster(path) if r.get("name")}
        _roster_cache = (path, mtime, names)
        return names
    except Exception as e:  # 명단 없음·형식 오류·엑셀 열기 실패 — 이름은 선택 정보라 조용히 넘어감
        logger.info("열람 기록용 이름 명단을 못 읽음: %s", e)
        return {}


def current_opener(req=None) -> "dict | None":
    """열기 요청을 한 로그인 사용자 {emp, name} — 로그인 안 했거나 로그인 요구가 꺼져 있으면 None(기록·이름 없는 경고만)"""
    try:
        import auth
        user = auth.current_user(req)
    except Exception:
        return None
    if not user:
        return None
    emp = str(user.get("emp_no", ""))
    name = str(user.get("name") or "")
    if not name or name == emp:   # 계정에 이름이 없으면(사번만) 명단에서
        name = _roster_names().get(emp, "") or emp
    return {"emp": emp, "name": name}


def record_file_open(path: str, opener: "dict | None") -> None:
    """이 파일을 방금 연 사람을 기록(파일당 가장 최근 1건). 오래된 기록은 이때 같이 정리. 실패해도 열기는 막지 않음"""
    if not opener:
        return
    now = time.time()
    try:
        with _open_lock:
            hist = {k: v for k, v in _load_open_history().items()
                    if isinstance(v, dict) and now - float(v.get("at", 0)) <= OPEN_NOTICE_SEC}
            hist[_open_key(path)] = {"emp": opener["emp"], "name": opener["name"], "at": now}
            os.makedirs(os.path.dirname(OPEN_HISTORY_PATH), exist_ok=True)
            tmp = OPEN_HISTORY_PATH + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(hist, f, ensure_ascii=False)
            os.replace(tmp, OPEN_HISTORY_PATH)
    except Exception as e:
        logger.warning("파일 열람 기록 실패: %s", e)


def open_notice(path: str, opener: "dict | None") -> "dict | None":
    """열기 전에 보여 줄 경고 — 없으면 None.
    ① 30분 안에 **다른 사람**이 연 기록 → "N분 전 ○○님이 열었습니다"(잠금파일이 있으면 "지금도 열려 있는 것으로 보임")
    ② 내가 직접 연 기록이 가장 최근 → 경고 없음(내 파일을 내가 다시 여는 것)
    ③ 기록이 없는데 잠금파일(~$)만 있음 → 누군가 열고 있는 듯(누구인지는 모름 — 대시보드 밖에서 연 사람 포함)"""
    locked = is_file_locked(path)
    entry = _load_open_history().get(_open_key(path))
    now = time.time()
    if isinstance(entry, dict) and now - float(entry.get("at", 0)) <= OPEN_NOTICE_SEC:
        if opener and entry.get("emp") == opener["emp"]:
            return None
        minutes = max(0, int((now - float(entry["at"])) // 60))
        ago = "방금 전" if minutes < 1 else f"{minutes}분 전"
        who = entry.get("name") or entry.get("emp") or "다른 사용자"
        tail = "지금도 열려 있는 것으로 보입니다." if locked else "이미 닫았을 수도 있습니다."
        return {"kind": "recent", "name": who, "minutes": minutes, "locked": locked,
                "message": f"{ago} {who}님이 이 파일을 열었습니다.\n{tail}"}
    if locked:
        return {"kind": "locked", "locked": True,
                "message": "다른 사람이 열고 있는 것으로 보입니다.\n(누가 열었는지는 알 수 없습니다)"}
    return None


def open_source_file(path: "str | None", check_only: bool = False, folder: bool = False,
                     opener: "dict | None" = None) -> "tuple[dict, int]":
    """원본 파일을 **요청한 사람의 PC**에서 열 수 있게 준비한다 — (응답 dict, HTTP 상태)를 돌려주고 jsonify는 라우트에서.
    예전(2026-11-06 이전)엔 서버 PC에서 os.startfile/explorer로 직접 열어서, 다른 PC에서 접속한 사람이 누르면
    서버를 켜 둔 PC에서 창이 열렸다. 지금은 서버가 아무것도 실행하지 않고 열기 주소(open_url)만 돌려주며,
    브라우저가 그 주소를 각 PC의 '파일 열기 도구'에 넘겨 그 PC에서 연다.
    서버가 하는 일은 검사·경고·기록뿐 — 위치 확인, DRM 차단은 어느 PC에서 열든 같다.
    check_only=True면 "열 수 있는지"만(응답 checked=True) — 열람 경고가 있으면 notice에 담아 주고, 프론트가 그 문구를 넣어
    "진짜 열까요?" 확인창을 띄운 뒤 다시 호출한다(2026-09-30). 두 번째 호출 응답의 open_url을 프론트가 브라우저로 넘긴다.
    열람 중이어도 막지 않는다(2026-11-06 — 이전엔 잠금파일이 있으면 409로 막아, 남은 잠금파일에 영영 막혔음). 열었다는 기록만 남김.
    DRM 파일은 check 단계부터 거절(blocked=True) — PC마다 DRM 에이전트가 원본을 제자리 재암호화할 수 있어서(2026-09-23)."""
    if not path or not os.path.exists(path):
        return {"ok": False, "message": "원본 위치를 찾을 수 없습니다 — 폴더가 이동했거나 재추출이 필요할 수 있습니다."}, 404
    if folder:
        # 폴더 바로가기(2026-10-06) — 그 파일이 든 폴더를 탐색기로 열고 파일을 선택해 둠. 파일 자체는 안 열어서
        # DRM·열람 검사도 기록도 필요 없음(NAS 원본을 건드리지 않음)
        if check_only:
            return {"ok": True, "checked": True}, 200
        return {"ok": True, "open_url": build_open_url(path, folder=True)}, 200
    if is_drm_file(path):
        logger.warning("DRM 파일 열기 차단: %s", path)
        return {"ok": False, "blocked": True,
                "message": "문서보안(DRM) 암호화 파일이라 대시보드에서 열 수 없습니다.\n원본 담당자에게 확인해주세요."}, 403
    if check_only:
        body: dict = {"ok": True, "checked": True}
        notice = open_notice(path, opener)
        if notice:
            body["notice"] = notice
        return body, 200
    record_file_open(path, opener)
    return {"ok": True, "open_url": build_open_url(path)}, 200


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
