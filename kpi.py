import logging
import os
import re
import threading
from datetime import datetime

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from flask import Blueprint, jsonify, request

load_dotenv()

logger = logging.getLogger(__name__)

kpi_bp = Blueprint("kpi", __name__)

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DATA_DIR  = os.path.join(_BASE_DIR, "data")

KPI_EXCEL_PATH = os.environ.get(
    "KPI_EXCEL_PATH",
    os.path.join(_DATA_DIR, "KPI 지표 데이터 추출.xlsx"),
)

_kpi_cache_lock   = threading.Lock()
_kpi_cached_mtime = None
_kpi_raw_df: pd.DataFrame = pd.DataFrame()
_kpi_agg_df: pd.DataFrame = pd.DataFrame()
_kpi_last_loaded  = None


def _safe_mtime(path):
    try:
        return os.path.getmtime(path)
    except OSError:
        return None


def _safe_num(v) -> float:
    try:
        f = float(v)
        return f if np.isfinite(f) else 0.0
    except Exception:
        return 0.0


def _read_sheet_via_com(xl_app, wb_com, sheet_name: str) -> pd.DataFrame:
    """열려있는 COM Workbook에서 시트 하나를 DataFrame으로 읽는다."""
    ws = None
    for i in range(1, wb_com.Sheets.Count + 1):
        if wb_com.Sheets(i).Name == sheet_name:
            ws = wb_com.Sheets(i)
            break
    if ws is None:
        logger.warning("시트 없음: %s", sheet_name)
        return pd.DataFrame()

    values = ws.UsedRange.Value2
    if not values:
        return pd.DataFrame()
    if not isinstance(values[0], tuple):
        values = [values]

    headers = [str(v) if v is not None else "" for v in values[0]]
    rows    = [list(r) for r in values[1:]]
    return pd.DataFrame(rows, columns=headers)


def _load_kpi_via_com() -> tuple[pd.DataFrame, pd.DataFrame]:
    """AIP 암호화 파일을 COM으로 직접 읽어 (취합_df, 집계_df) 반환."""
    try:
        import pythoncom
        import win32com.client
    except ImportError:
        logger.error("win32com 없음 — pip install pywin32 필요")
        return pd.DataFrame(), pd.DataFrame()

    xl_app = None
    wb_com = None
    try:
        pythoncom.CoInitialize()
        xl_app = win32com.client.DispatchEx("Excel.Application")
        xl_app.Visible = False
        xl_app.DisplayAlerts = False
        wb_com = xl_app.Workbooks.Open(
            os.path.abspath(KPI_EXCEL_PATH),
            UpdateLinks=False,
            ReadOnly=True,
            IgnoreReadOnlyRecommended=True,
        )
        raw_df = _read_sheet_via_com(xl_app, wb_com, "취합")
        agg_df = _read_sheet_via_com(xl_app, wb_com, "kpi 집계")
        logger.info("KPI COM 읽기 완료 — 취합 %d행, 집계 %d행", len(raw_df), len(agg_df))
        return raw_df, agg_df
    except Exception as e:
        logger.error("_load_kpi_via_com 실패: %s", e)
        return pd.DataFrame(), pd.DataFrame()
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


def _post_process_raw(df: pd.DataFrame) -> pd.DataFrame:
    """취합 시트 공통 후처리 (프로젝트코드 정제 + fillna)."""
    if df.empty:
        return df
    code_col = next((c for c in df.columns if "프로젝트코드" in str(c)), None)
    if code_col:
        df = df[
            df[code_col].notna() & (df[code_col].astype(str).str.strip() != "")
        ].reset_index(drop=True)
        df[code_col] = (
            df[code_col].astype(str).str.strip().str.replace(r"\s*\(", " (", regex=True)
        )
    return df.fillna(0)


def load_kpi_excel():
    """_kpi_cache_lock 보유 상태에서만 호출."""
    global _kpi_raw_df, _kpi_agg_df, _kpi_last_loaded, _kpi_cached_mtime
    if not os.path.exists(KPI_EXCEL_PATH):
        logger.warning("KPI_EXCEL_PATH 없음 — 추출 스크립트 실행 필요: %s", KPI_EXCEL_PATH)
        _kpi_raw_df       = pd.DataFrame()
        _kpi_agg_df       = pd.DataFrame()
        _kpi_last_loaded  = None
        _kpi_cached_mtime = None
        return

    with open(KPI_EXCEL_PATH, "rb") as _fh:
        _sig = _fh.read(8)

    if _sig[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
        logger.warning("KPI_EXCEL_PATH AIP/OLE2 — COM 직접 읽기: %s", KPI_EXCEL_PATH)
        raw_df, agg_df = _load_kpi_via_com()
        if raw_df.empty and agg_df.empty:
            logger.error("KPI COM 읽기 실패")
            _kpi_raw_df = pd.DataFrame()
            _kpi_agg_df = pd.DataFrame()
            return
        _kpi_raw_df = _post_process_raw(raw_df)
        _kpi_agg_df = agg_df
    else:
        wb = pd.ExcelFile(KPI_EXCEL_PATH, engine="openpyxl")
        sheet_names = wb.sheet_names
        _kpi_raw_df = _post_process_raw(wb.parse("취합", header=0)) if "취합" in sheet_names else pd.DataFrame()
        _kpi_agg_df = wb.parse("kpi 집계", header=0) if "kpi 집계" in sheet_names else pd.DataFrame()

    logger.info("KPI 취합 %d행 / 집계 %d행 로드 완료", len(_kpi_raw_df), len(_kpi_agg_df))
    _kpi_last_loaded  = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    _kpi_cached_mtime = _safe_mtime(KPI_EXCEL_PATH)


def get_kpi_df() -> pd.DataFrame:
    """파일 mtime이 바뀌면 자동으로 다시 읽는다."""
    global _kpi_raw_df, _kpi_cached_mtime
    current_mtime = _safe_mtime(KPI_EXCEL_PATH)
    if not _kpi_raw_df.empty and current_mtime == _kpi_cached_mtime:
        return _kpi_raw_df
    with _kpi_cache_lock:
        current_mtime = _safe_mtime(KPI_EXCEL_PATH)
        if _kpi_raw_df.empty or current_mtime != _kpi_cached_mtime:
            try:
                load_kpi_excel()
            except Exception as e:
                logger.error("load_kpi_excel() 실패: %s", e)
                _kpi_cached_mtime = current_mtime
    return _kpi_raw_df


def _load_kpi_items_from_cache() -> list:
    if _kpi_agg_df.empty:
        return []

    cols     = list(_kpi_agg_df.columns)
    name_col = next((c for c in cols if "구분" in str(c)), None)
    if name_col is None:
        logger.warning("_load_kpi_items: '구분' 컬럼 없음. 헤더: %s", cols)
        return []

    target_col_candidates = [c for c in cols if "목표" in str(c) and "프로젝트" in str(c)]
    if not target_col_candidates:
        target_col_candidates = [c for c in cols if "목표" in str(c)]
    target_col = None
    for c in target_col_candidates:
        if _kpi_agg_df[c].notna().any():
            target_col = c
            break
    if target_col is None and target_col_candidates:
        target_col = target_col_candidates[0]

    items = []
    for _, row in _kpi_agg_df.iterrows():
        name_val = row[name_col] if name_col else None
        if name_val is None or (isinstance(name_val, float) and np.isnan(name_val)):
            continue
        name = str(name_val).strip()
        if not name:
            continue

        target_val = row[target_col] if target_col else None
        agg = "sum" if "건수" in name else "avg"

        if isinstance(target_val, str) and target_val.strip():
            target = target_val.strip()
        elif target_val is None or (isinstance(target_val, float) and np.isnan(target_val)):
            target = 0.0
        else:
            target = _safe_num(target_val)

        items.append({"name": name, "agg": agg, "target": target})

    return items


def _parse_new_old_count(value) -> tuple:
    s     = str(value)
    m_new = re.search(r"신규\s*:\s*(\d+)건", s)
    m_old = re.search(r"기존\s*:\s*(\d+)건", s)
    return (
        int(m_new.group(1)) if m_new else 0,
        int(m_old.group(1)) if m_old else 0,
    )


def _aggregate_kpi_col(kpi_items: list, col_keyword: str) -> list:
    if _kpi_raw_df.empty:
        return [0.0] * len(kpi_items)

    target_cols = [
        c for c in _kpi_raw_df.columns
        if col_keyword in re.sub(r"\s+", "", str(c))
    ]
    if not target_cols:
        logger.warning("_aggregate_kpi_col: '%s' 컬럼 없음. 헤더: %s",
                       col_keyword, list(_kpi_raw_df.columns[:10]))
        return [0.0] * len(kpi_items)

    if len(target_cols) != len(kpi_items):
        logger.warning("_aggregate_kpi_col: '%s' 컬럼 수(%d) ≠ KPI 항목 수(%d)",
                       col_keyword, len(target_cols), len(kpi_items))

    result = []
    for i, kpi in enumerate(kpi_items):
        col = target_cols[i] if i < len(target_cols) else None
        if col is None:
            result.append(0.0)
            continue

        is_count_type = isinstance(kpi.get("target", 0), str) and "신규" in str(kpi.get("target", ""))
        if is_count_type:
            new_total = 0
            old_total = 0
            for raw_val in _kpi_raw_df[col]:
                if raw_val is None:
                    continue
                val_str = str(raw_val).strip()
                if "신규" in val_str:
                    m_new = re.search(r"신규\s*:\s*(\d+)건", val_str)
                    m_old = re.search(r"기존\s*:\s*(\d+)건", val_str)
                    if m_new: new_total += int(m_new.group(1))
                    if m_old: old_total += int(m_old.group(1))
            result.append(f"신규:{new_total}건/기존:{old_total}건")
            continue

        values = []
        for raw_val in _kpi_raw_df[col]:
            if raw_val is None:
                continue
            val_str = str(raw_val).strip()
            if not val_str or val_str in ("0", "0.0", "nan"):
                continue
            if val_str in ("N", "TBD", "-", "n/a", "N/A"):
                continue
            try:
                cleaned = re.sub(r"[^\d.\-]", "", val_str.replace(",", ""))
                if not cleaned:
                    continue
                f = float(cleaned)
                if np.isfinite(f) and f != 0:
                    values.append(f)
            except (ValueError, TypeError):
                pass

        if not values:
            result.append(0.0)
        elif kpi["agg"] == "sum":
            result.append(round(sum(values), 2))
        else:
            result.append(round(sum(values) / len(values), 2))

    return result


_SKIP_VALS = {"0", "0.0", "nan", "", "-", "N", "TBD", "n/a", "N/A"}


def _parse_col_num(val_str: str) -> float | None:
    cleaned = re.sub(r"[^\d.\-]", "", val_str.replace(",", ""))
    if not cleaned:
        return None
    try:
        f = float(cleaned)
        return f if np.isfinite(f) else None
    except (ValueError, TypeError):
        return None


def _compute_achieve_rates(kpi_items: list) -> list:
    """
    평균형 KPI: 프로젝트별 actual_i/target_i * 100 의 평균 — 부서별 목표가 달라도 올바른 집계.
    합계형 KPI: sum(actual_i) / sum(target_i) * 100.
    신규/기존 건수 타입: None 반환 (호출부에서 별도 계산).
    """
    if _kpi_raw_df.empty:
        return [None] * len(kpi_items)

    actual_cols = [c for c in _kpi_raw_df.columns if "PJ실적" in re.sub(r"\s+", "", str(c))]
    target_cols = [c for c in _kpi_raw_df.columns if "PJ목표" in re.sub(r"\s+", "", str(c))]

    result = []
    for i, kpi in enumerate(kpi_items):
        is_count_type = isinstance(kpi.get("target", 0), str) and "신규" in str(kpi.get("target", ""))
        if is_count_type:
            result.append(None)
            continue

        a_col = actual_cols[i] if i < len(actual_cols) else None
        t_col = target_cols[i] if i < len(target_cols) else None
        if a_col is None or t_col is None:
            result.append(None)
            continue

        pairs = []
        for _, row in _kpi_raw_df.iterrows():
            a_str = str(row[a_col]).strip()
            t_str = str(row[t_col]).strip()
            if a_str in _SKIP_VALS or t_str in _SKIP_VALS:
                continue
            a = _parse_col_num(a_str)
            t = _parse_col_num(t_str)
            if a is not None and t is not None and t != 0:
                pairs.append((a, t))

        if not pairs:
            result.append(None)
        elif kpi["agg"] == "sum":
            result.append(round(sum(a for a, _ in pairs) / sum(t for _, t in pairs) * 100, 1))
        else:
            result.append(round(sum(a / t * 100 for a, t in pairs) / len(pairs), 1))

    return result


def apply_kpi_filters(df: pd.DataFrame) -> pd.DataFrame:
    years  = request.args.getlist("year")
    parts  = request.args.getlist("part")
    stages = request.args.getlist("stage")
    if years:
        df = df[df["수행연도"].isin(years)]
    if parts:
        df = df[df["파트명"].isin(parts)]
    if stages:
        df = df[df["보고단계"].isin(stages)]
    return df


# ──────────────────────────────────────────────────────────────
# KPI API
# ──────────────────────────────────────────────────────────────

@kpi_bp.route("/api/kpi/options")
def api_kpi_options():
    df = get_kpi_df()
    if df.empty:
        return jsonify({"years": [], "parts": [], "stages": []})
    return jsonify({
        "years":  sorted(df["수행연도"].dropna().unique().tolist()),
        "parts":  sorted(df["파트명"].dropna().unique().tolist()),
        "stages": sorted(df["보고단계"].dropna().unique().tolist()),
    })


@kpi_bp.route("/api/kpi/data")
def api_kpi_data():
    df = get_kpi_df()
    if df.empty:
        return jsonify({"data": [], "total": 0})

    df = apply_kpi_filters(df)

    search = request.args.get("search", "").strip()
    field  = request.args.get("field", "").strip()
    if search:
        s = search.lower()
        if field and field in df.columns:
            mask = df[field].astype(str).str.lower().str.contains(s, regex=False, na=False)
        else:
            mask = df.apply(
                lambda row: any(s in str(v).lower() for v in row if v is not None),
                axis=1,
            )
        df = df[mask]

    total = len(df)
    try:
        page      = max(1, int(request.args.get("page", 1)))
        page_size = min(200, max(1, int(request.args.get("page_size", 30))))
    except (ValueError, TypeError):
        page, page_size = 1, 30

    start = (page - 1) * page_size
    paged = df.iloc[start:start + page_size].copy().replace({float("nan"): None})
    paged["_row_num"] = range(start, start + len(paged))
    return jsonify({"data": paged.to_dict(orient="records"), "total": total})


@kpi_bp.route("/api/kpi/summary")
def api_kpi_summary():
    if not os.path.exists(KPI_EXCEL_PATH):
        return jsonify({"available": False, "message": "KPI 추출 스크립트를 먼저 실행해주세요."})

    get_kpi_df()

    if _kpi_agg_df.empty:
        return jsonify({"available": False, "message": "kpi 집계 시트를 읽을 수 없습니다."})

    try:
        kpi_items     = _load_kpi_items_from_cache()
        actuals       = _aggregate_kpi_col(kpi_items, "PJ실적")
        prevs         = _aggregate_kpi_col(kpi_items, "PJ유사")
        achieve_rates = _compute_achieve_rates(kpi_items)

        result = []
        for i, kpi in enumerate(kpi_items):
            target  = kpi["target"]
            actual  = actuals[i] if i < len(actuals) else 0.0
            prev    = prevs[i]   if i < len(prevs)   else 0.0
            # 프로젝트별 페어가 있으면 per-project avg 사용, 없으면 집계 기반 폴백
            achieve = achieve_rates[i]
            if achieve is None and not isinstance(target, str):
                target_num = float(target)
                achieve = round(actual / target_num * 100, 1) if target_num != 0 else 0.0

            if isinstance(target, str) and "신규" in target:
                target_new, target_old = _parse_new_old_count(target)
                actual_new, actual_old = _parse_new_old_count(actual)
                prev_new,   prev_old   = _parse_new_old_count(prev)

                for suffix, t, a, p in (
                    ("신규", target_new, actual_new, prev_new),
                    ("기존", target_old, actual_old, prev_old),
                ):
                    result.append({
                        "name":         kpi["name"].replace("신규/기존", suffix),
                        "agg":          kpi["agg"],
                        "target_2026":  t,
                        "actual_2026":  a,
                        "prev_actual":  p,
                        "achieve_rate": round(a / t * 100, 1) if t else 0.0,
                    })
                continue

            if isinstance(target, str):
                target_out = target
            else:
                target_out = float(target)

            result.append({
                "name":         kpi["name"],
                "agg":          kpi["agg"],
                "target_2026":  target_out,
                "actual_2026":  actual,
                "prev_actual":  prev,
                "achieve_rate": achieve,
            })

        return jsonify({"available": True, "items": result})

    except Exception as e:
        logger.error("api_kpi_summary 오류: %s", e)
        return jsonify({"available": False, "message": f"KPI 집계 오류: {e}"})


@kpi_bp.route("/api/kpi/reload", methods=["POST"])
def api_kpi_reload():
    try:
        with _kpi_cache_lock:
            load_kpi_excel()
            count     = len(_kpi_raw_df)
            loaded_at = _kpi_last_loaded
        return jsonify({"ok": True, "loaded_at": loaded_at, "count": count})
    except Exception as e:
        logger.error("api_kpi_reload 실패: %s", e)
        return jsonify({"ok": False, "error": str(e)}), 500
