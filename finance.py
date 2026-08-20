import io
import json
import logging
import os
import re
import threading
from datetime import datetime
from urllib.parse import quote

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from flask import Blueprint, jsonify, request, make_response
from markupsafe import escape as html_escape

from shared import is_ranked_valid_code

load_dotenv()

logger = logging.getLogger(__name__)

finance_bp = Blueprint("finance", __name__)

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DATA_DIR  = os.path.join(_BASE_DIR, "data")

EXCEL_PATH = os.environ.get(
    "EXCEL_PATH",
    os.path.join(_DATA_DIR, "재무관점 필수 데이터 추출.xlsx"),
)

EXCEL_COLS = [
    "project_code", "year", "part", "stage",
    "revenue", "expenditure", "direct_cost", "labor_cost",
    "overhead", "operating_profit", "profit_rate",
    "note", "filename", "processed_at", "reflected_at",
]
COLUMNS = EXCEL_COLS

_cached_df: pd.DataFrame = pd.DataFrame()
_last_loaded = None
_cached_mtime = None
_cache_lock = threading.Lock()
_last_correction_count = 0

_STAGE_PRIORITY = ["검토", "사업계획", "사전검토", "제안", "착수", "중간", "완료"]


def _empty_df() -> pd.DataFrame:
    return pd.DataFrame(columns=COLUMNS)


def _safe_mtime(path):
    try:
        return os.path.getmtime(path)
    except OSError:
        return None


def _extract_year(filename: str, reflected_at) -> str:
    m = re.search(r"(\d{2})년", str(filename))
    if m:
        return "20" + m.group(1)
    try:
        return str(pd.to_datetime(reflected_at).year)
    except Exception:
        return ""


def _extract_part(filename: str) -> str:
    name = re.sub(r"\.pptx?$", "", str(filename), flags=re.IGNORECASE)
    parts = name.split("_")
    if len(parts) >= 2:
        raw = re.sub(r"[\[\]]", "", parts[-2]).strip()
        if re.fullmatch(r"\d{4,6}", raw):
            return "기타"
        return raw
    return "기타"


def _read_excel_via_com(path: str, sheet_name: str) -> "pd.DataFrame | None":
    """AIP 암호화 Excel을 win32com으로 열어 DataFrame으로 반환."""
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
        xl_app = win32com.client.DispatchEx("Excel.Application")
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
        logger.error("_read_excel_via_com 실패: %s", e)
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


def load_excel():
    """_cache_lock 보유 상태에서만 호출할 것."""
    global _cached_df, _last_loaded, _cached_mtime, _last_correction_count
    if not os.path.exists(EXCEL_PATH):
        logger.error("EXCEL_PATH 없음: %s", EXCEL_PATH)
        _cached_df = _empty_df()
        _last_loaded = None
        _cached_mtime = None
        return _cached_df

    with open(EXCEL_PATH, "rb") as _fh:
        _sig = _fh.read(8)
    _is_ole2 = _sig[:8] == b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"

    if _is_ole2:
        logger.warning("EXCEL_PATH 가 AIP/OLE2 형식 — win32com 으로 읽기 시도: %s", EXCEL_PATH)
        df_all = _read_excel_via_com(EXCEL_PATH, sheet_name="취합")
        if df_all is None:
            logger.error("win32com 읽기 실패 — 빈 데이터 반환")
            _cached_df = _empty_df()
            return _cached_df
    else:
        df_all = pd.read_excel(EXCEL_PATH, sheet_name="취합", header=0, engine="openpyxl")
    actual_cols = df_all.shape[1]

    if actual_cols < len(EXCEL_COLS):
        raise ValueError(
            f"엑셀 컬럼 수 부족 (기대 {len(EXCEL_COLS)}개, 실제 {actual_cols}개). "
            f"year·part 컬럼이 추가된 최신 추출 스크립트로 재추출 필요. "
            f"헤더: {list(df_all.columns[:5])}"
        )

    df = df_all.iloc[:, :len(EXCEL_COLS)]
    df.columns = EXCEL_COLS
    df = df[df["project_code"].notna() & (df["project_code"].astype(str).str.strip() != "")]

    df["year"] = df["year"].astype(str).str.replace(r'\.0$', '', regex=True).str.strip()
    mask_no_year = df["year"].isin(["", "nan", "None"])
    if mask_no_year.any():
        df.loc[mask_no_year, "year"] = df.loc[mask_no_year].apply(
            lambda r: _extract_year(r["filename"], r["reflected_at"]), axis=1
        )

    df["part"] = df["part"].astype(str).str.strip()
    mask_no_part = df["part"].isin(["", "nan", "None"])
    if mask_no_part.any():
        df.loc[mask_no_part, "part"] = df.loc[mask_no_part, "filename"].apply(_extract_part)

    for col in ["processed_at", "reflected_at"]:
        df[col] = (
            pd.to_datetime(df[col], errors="coerce")
            .dt.strftime("%Y-%m-%d")
            .fillna("")
        )

    num_cols = ["revenue", "expenditure", "direct_cost", "labor_cost",
                "overhead", "operating_profit", "profit_rate"]
    for col in num_cols:
        df[col] = (
            df[col].astype(str)
            .str.replace("%", "", regex=False)
            .str.replace(",", "", regex=False)
            .str.strip()
        )
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    bad_rate = df["profit_rate"].abs() > 200
    _last_correction_count = int(bad_rate.sum())
    if bad_rate.any():
        bad_rows = df.loc[bad_rate, ["project_code", "filename", "profit_rate"]]
        logger.warning(
            "profit_rate 보정 %d행 (추출 스크립트 확인 필요): %s",
            len(bad_rows), bad_rows.to_dict("records"),
        )
    has_revenue = df["revenue"] > 0
    df.loc[bad_rate & has_revenue, "profit_rate"] = (
        df.loc[bad_rate & has_revenue, "operating_profit"]
        / df.loc[bad_rate & has_revenue, "revenue"]
        * 100
    ).round(1)
    df.loc[bad_rate & ~has_revenue, "profit_rate"] = 0

    plain_str_cols = ["project_code", "part", "stage", "note", "filename"]
    for col in plain_str_cols:
        df[col] = df[col].astype(str).str.strip().replace("nan", "")

    df["project_code"] = df["project_code"].str.replace(r"\s*\(", " (", regex=True)
    df = df[COLUMNS]

    _cached_df = df
    _last_loaded = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    _cached_mtime = _safe_mtime(EXCEL_PATH)
    logger.info("엑셀 로드 완료: %d행", len(df))
    return df


def get_df() -> pd.DataFrame:
    """파일 mtime이 바뀌면 자동으로 다시 읽는다."""
    global _cached_df, _last_loaded, _cached_mtime
    current_mtime = _safe_mtime(EXCEL_PATH)
    if not _cached_df.empty and current_mtime == _cached_mtime:
        return _cached_df
    with _cache_lock:
        current_mtime = _safe_mtime(EXCEL_PATH)
        if _cached_df.empty or current_mtime != _cached_mtime:
            try:
                load_excel()
            except Exception as e:
                logger.error("load_excel() 실패, 빈 데이터 반환: %s", e)
                _cached_df = _empty_df()
                _last_loaded = None
                _cached_mtime = current_mtime
        return _cached_df


def apply_filters(df: pd.DataFrame) -> pd.DataFrame:
    years  = request.args.getlist("year")
    parts  = request.args.getlist("part")
    stages = request.args.getlist("stage")
    if years:
        df = df[df["year"].isin(years)]
    if parts:
        df = df[df["part"].isin(parts)]
    if stages:
        df = df[df["stage"].isin(stages)]
    return df


def bil(v):
    return f"{v / 1e8:.1f}".replace("-0.0", "0.0") + "억원"


def _safe_avg_rate(x) -> float:
    pos = pd.to_numeric(x, errors="coerce")
    pos = pos[pos > 0].dropna()
    return round(float(pos.mean()), 1) if not pos.empty else 0


def _build_part_stats(df: pd.DataFrame) -> pd.DataFrame:
    return (
        df.groupby("part")
        .agg(
            revenue=("revenue", "sum"),
            profit=("operating_profit", "sum"),
            count=("project_code", "count"),
            avg_rate=("profit_rate", _safe_avg_rate),
        )
        .reset_index()
    )


def _sort_stages(stage_list):
    priority_map = {s: i for i, s in enumerate(_STAGE_PRIORITY)}
    known  = [s for s in _STAGE_PRIORITY if s in stage_list]
    others = sorted(s for s in stage_list if s not in priority_map)
    return known + others


def _register_pdf_font() -> str:
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        font_path = "C:/Windows/Fonts/malgun.ttf"
        if os.path.exists(font_path) and "Malgun" not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont("Malgun", font_path))
        return "Malgun" if "Malgun" in pdfmetrics.getRegisteredFontNames() else "Helvetica"
    except Exception:
        return "Helvetica"


_PDF_FONT = _register_pdf_font()


# ──────────────────────────────────────────────────────────────
# 재무 API
# ──────────────────────────────────────────────────────────────

@finance_bp.route("/api/data")
def api_data():
    df = apply_filters(get_df())

    search = request.args.get("search", "").strip()
    field  = request.args.get("field", "").strip()
    _SEARCHABLE_COLS = {"project_code", "part", "stage", "note", "filename"}
    if search:
        s = search.lower()
        if field in _SEARCHABLE_COLS:
            mask = df[field].str.lower().str.contains(s, regex=False, na=False)
        else:
            mask = (
                df["project_code"].str.lower().str.contains(s, regex=False, na=False) |
                df["part"].str.lower().str.contains(s, regex=False, na=False) |
                df["stage"].str.lower().str.contains(s, regex=False, na=False) |
                df["note"].str.lower().str.contains(s, regex=False, na=False) |
                df["filename"].str.lower().str.contains(s, regex=False, na=False)
            )
        df = df[mask]

    total = len(df)
    try:
        page      = max(1, int(request.args.get("page", 1)))
        page_size = min(200, max(1, int(request.args.get("page_size", 30))))
    except (ValueError, TypeError):
        page, page_size = 1, 30

    start = (page - 1) * page_size
    paged = df.iloc[start:start + page_size].copy()
    paged["_row_num"] = range(start, start + len(paged))
    records = json.loads(paged.to_json(orient="records", force_ascii=False))
    return jsonify({"data": records, "total": total})


@finance_bp.route("/api/summary")
def api_summary():
    df = apply_filters(get_df())
    if df.empty:
        return jsonify({
            "total_revenue": 0, "total_expenditure": 0, "total_profit": 0,
            "avg_profit_rate": 0, "count": 0, "by_part": {}, "by_year": {}, "by_stage": {},
            "cost_breakdown": {"direct_cost": 0, "labor_cost": 0, "overhead": 0},
        })

    rates  = df["profit_rate"]
    by_part = (
        df.groupby("part")
        .agg(
            revenue=("revenue", "sum"),
            expenditure=("expenditure", "sum"),
            direct_cost=("direct_cost", "sum"),
            labor_cost=("labor_cost", "sum"),
            overhead=("overhead", "sum"),
            profit=("operating_profit", "sum"),
            count=("project_code", "count"),
        )
        .to_dict(orient="index")
    )

    by_year = (
        df.groupby("year")
        .agg(
            revenue=("revenue", "sum"),
            expenditure=("expenditure", "sum"),
            profit=("operating_profit", "sum"),
            count=("project_code", "count"),
            avg_profit_rate=("profit_rate", _safe_avg_rate),
        )
        .to_dict(orient="index")
    )

    by_stage_raw = (
        get_df().groupby("stage")
        .agg(
            revenue=("revenue", "sum"),
            expenditure=("expenditure", "sum"),
            profit=("operating_profit", "sum"),
            count=("project_code", "count"),
        )
        .to_dict(orient="index")
    )
    known   = [s for s in _STAGE_PRIORITY if s in by_stage_raw]
    unknown = sorted(k for k in by_stage_raw if k not in _STAGE_PRIORITY)
    by_stage = {s: by_stage_raw[s] for s in known + unknown}

    return jsonify({
        "total_revenue":    df["revenue"].sum(),
        "total_expenditure": df["expenditure"].sum(),
        "total_profit":     df["operating_profit"].sum(),
        "avg_profit_rate":  round(rates.mean(), 1) if not rates.empty else 0,
        "count":            len(df),
        "by_part":          by_part,
        "by_year":          by_year,
        "by_stage":         by_stage,
        "cost_breakdown": {
            "direct_cost": df["direct_cost"].sum(),
            "labor_cost":  df["labor_cost"].sum(),
            "overhead":    df["overhead"].sum(),
        },
    })


@finance_bp.route("/api/insights")
def api_insights():
    df    = apply_filters(get_df())
    valid = df[df["revenue"] > 0].copy()

    if valid.empty:
        return jsonify({"top": [], "risk": [], "comments": []})

    valid_coded = valid[valid["project_code"].apply(is_ranked_valid_code)]

    top5 = (
        valid_coded[valid_coded["profit_rate"] > 0]
        .nlargest(10, "profit_rate")
        [["project_code", "part", "stage", "revenue", "operating_profit", "profit_rate"]]
        .to_dict(orient="records")
    )
    _risk_pool = valid_coded[
        (valid_coded["operating_profit"] < 0) | (valid_coded["profit_rate"] < 5)
    ].copy()
    _risk_pool["_is_loss"] = (_risk_pool["operating_profit"] < 0).astype(int)
    risk = (
        _risk_pool
        .sort_values(["_is_loss", "profit_rate"], ascending=[False, True])
        .head(10)
        .drop(columns=["_is_loss"])
        [["project_code", "part", "stage", "revenue", "operating_profit", "profit_rate"]]
        .to_dict(orient="records")
    )

    part_stats   = _build_part_stats(valid).set_index("part")
    total_revenue = valid["revenue"].sum()
    total_profit  = valid["operating_profit"].sum()
    rates_all     = valid[valid["profit_rate"] > 0]["profit_rate"]
    avg_rate      = round(rates_all.mean(), 1) if not rates_all.empty else 0
    total_dc  = valid["direct_cost"].sum()
    total_lc  = valid["labor_cost"].sum()
    total_oh  = valid["overhead"].sum()
    total_cost = total_dc + total_lc + total_oh

    best_part    = part_stats["avg_rate"].idxmax() if not part_stats.empty else None
    worst_part   = part_stats["avg_rate"].idxmin() if not part_stats.empty else None
    top_rev_part = part_stats["revenue"].idxmax() if not part_stats.empty else None
    biggest      = valid.nlargest(1, "revenue").iloc[0] if not valid.empty else None

    comments = []

    loss_rows = valid[valid["operating_profit"] < 0].nsmallest(3, "operating_profit")
    for _, lrow in loss_rows.iterrows():
        comments.append({
            "type": "warning", "icon": "",
            "text": f"<b>{html_escape(str(lrow['project_code']))}</b> 손실 {bil(lrow['operating_profit'])} — 확인 필요",
        })

    thin_rows = valid[(valid["operating_profit"] >= 0) & (valid["profit_rate"] < 5)].nsmallest(2, "profit_rate")
    for _, trow in thin_rows.iterrows():
        comments.append({
            "type": "warning", "icon": "",
            "text": f"<b>{html_escape(str(trow['project_code']))}</b> ({html_escape(str(trow['part']))}) 이익율 {round(trow['profit_rate'],1)}% — 저수익",
        })

    if worst_part and best_part and worst_part != best_part:
        gap2 = round(part_stats.loc[best_part, "avg_rate"] - part_stats.loc[worst_part, "avg_rate"], 1)
        comments.append({
            "type": "warning", "icon": "",
            "text": f"<b>{html_escape(worst_part)}</b> 이익율 {part_stats.loc[worst_part, 'avg_rate']}% — {html_escape(best_part)} 대비 -{gap2}%p",
        })

    if best_part and part_stats.loc[best_part, "avg_rate"] > avg_rate:
        gap = round(part_stats.loc[best_part, "avg_rate"] - avg_rate, 1)
        comments.append({
            "type": "positive", "icon": "",
            "text": f"<b>{html_escape(best_part)}</b> 이익율 {part_stats.loc[best_part, 'avg_rate']}% (평균 +{gap}%p)",
        })

    if biggest is not None:
        comments.append({
            "type": "info", "icon": "",
            "text": f"최대 매출 <b>{html_escape(str(biggest['project_code']))}</b> {bil(biggest['revenue'])} ({html_escape(str(biggest['part']))} · {html_escape(str(biggest['stage']))})",
        })

    if total_cost > 0:
        comments.append({
            "type": "neutral", "icon": "",
            "text": f"원가: 직접 {round(total_dc/total_cost*100,1)}% / 인건비 {round(total_lc/total_cost*100,1)}% / 공통 {round(total_oh/total_cost*100,1)}%",
        })

    if total_revenue:
        overall_rate = round(total_profit / total_revenue * 100, 1)
        comments.append({
            "type": "positive" if overall_rate >= avg_rate else "neutral", "icon": "",
            "text": f"전체 실질 이익율 <b>{overall_rate}%</b> (필터 기준)",
        })

    return jsonify({"top": top5, "risk": risk, "comments": comments})


@finance_bp.route("/api/reload", methods=["POST"])
def api_reload():
    try:
        with _cache_lock:
            load_excel()
            local_corrected = _last_correction_count
            local_loaded    = _last_loaded
            local_count     = len(_cached_df)
        return jsonify({
            "ok": True,
            "loaded_at": local_loaded,
            "count": local_count,
            "corrected_rows": local_corrected,
        })
    except Exception as e:
        logger.error("api_reload 실패: %s", e)
        return jsonify({"ok": False, "error": str(e)}), 500


@finance_bp.route("/api/export/pdf")
def api_export_pdf():
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

    df    = apply_filters(get_df())
    valid = df[df["revenue"] > 0]

    buffer   = io.BytesIO()
    doc      = SimpleDocTemplate(buffer, pagesize=A4,
                                 rightMargin=15*mm, leftMargin=15*mm,
                                 topMargin=15*mm, bottomMargin=15*mm)
    font_name = _PDF_FONT

    title_style  = ParagraphStyle("title",  fontName=font_name, fontSize=18, spaceAfter=2,  textColor=colors.black, leading=22)
    sub_style    = ParagraphStyle("sub",    fontName=font_name, fontSize=12, spaceAfter=4,  textColor=colors.black, fontWeight="bold")
    normal_style = ParagraphStyle("normal", fontName=font_name, fontSize=10, spaceAfter=0,  textColor=colors.black)
    code_style   = ParagraphStyle("code",   fontName=font_name, fontSize=8, leading=11, wordWrap="LTR", alignment=0)

    HEADER_COLOR = colors.HexColor("#374151")
    BORDER_COLOR = colors.HexColor("#D1D5DB")
    COL_W         = [50*mm, 40*mm, 40*mm, 30*mm, 20*mm]
    PROJECT_COL_W = [70*mm, 22*mm, 22*mm, 36*mm, 30*mm]

    def wrap_code(text: str) -> Paragraph:
        return Paragraph(str(text), code_style)

    def tbl_style(left_align_col0: bool = False):
        style = TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0),  HEADER_COLOR),
            ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
            ("FONTNAME",      (0, 0), (-1, -1), font_name),
            ("FONTSIZE",      (0, 0), (-1, 0),  10),
            ("FONTSIZE",      (0, 1), (-1, -1), 9),
            ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("GRID",          (0, 0), (-1, -1), 0.4, BORDER_COLOR),
            ("LINEBELOW",     (0, 0), (-1, 0),  1,   colors.white),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ])
        if left_align_col0:
            style.add("ALIGN", (0, 1), (0, -1), "LEFT")
        return style

    elements = []

    _years  = request.args.getlist("year")
    _parts  = request.args.getlist("part")
    _stages = request.args.getlist("stage")
    _filter_labels = []
    if _years:  _filter_labels.append(", ".join(f"{y}년" for y in _years))
    if _parts:  _filter_labels.append(", ".join(_parts))
    if _stages: _filter_labels.append(", ".join(_stages))

    title_text = "재무 현황 보고서"
    if _filter_labels:
        title_text += f" ({' | '.join(_filter_labels)})"

    elements.append(Paragraph(title_text, title_style))
    elements.append(Paragraph(f"출력일: {datetime.now().strftime('%Y-%m-%d %H:%M')}", normal_style))
    elements.append(Spacer(1, 4*mm))

    elements.append(Paragraph("전체 요약", sub_style))
    rates    = valid[valid["profit_rate"] > 0]["profit_rate"]
    avg_rate = round(rates.mean(), 1) if not rates.empty else 0
    kpi_data = [
        ["총 매출", "총 지출", "경상이익", "평균 이익율", "프로젝트 수"],
        [
            f"{valid['revenue'].sum()/1e8:.1f}억원",
            f"{valid['expenditure'].sum()/1e8:.1f}억원",
            f"{valid['operating_profit'].sum()/1e8:.1f}억원",
            f"{avg_rate}%",
            f"{len(valid)}건",
        ],
    ]
    t = Table(kpi_data, colWidths=COL_W)
    t.setStyle(tbl_style())
    elements += [t, Spacer(1, 6*mm)]

    if not valid.empty:
        elements.append(Paragraph("파트별 실적", sub_style))
        part_stats = _build_part_stats(valid)
        part_data  = [["파트", "매출", "경상이익", "평균이익율", "건수"]]
        for _, row in part_stats.iterrows():
            part_data.append([
                row["part"],
                f"{row['revenue']/1e8:.1f}억",
                f"{row['profit']/1e8:.1f}억",
                f"{row['avg_rate']}%",
                f"{int(row['count'])}건",
            ])
        t2 = Table(part_data, colWidths=COL_W)
        t2.setStyle(tbl_style())
        elements += [t2, Spacer(1, 6*mm)]

    top5 = valid[valid["profit_rate"] > 0].nlargest(5, "profit_rate")
    if not top5.empty:
        elements.append(Paragraph("이익율 TOP 5", sub_style))
        top_data = [["프로젝트코드", "파트", "단계", "매출", "이익율"]]
        for _, row in top5.iterrows():
            top_data.append([
                wrap_code(row["project_code"]), row["part"], row["stage"],
                f"{row['revenue']/1e8:.1f}억",
                f"{round(row['profit_rate'], 1)}%",
            ])
        t3 = Table(top_data, colWidths=PROJECT_COL_W, repeatRows=1)
        t3.setStyle(tbl_style(left_align_col0=True))
        elements += [t3, Spacer(1, 6*mm)]

    _risk_pool = valid[(valid["operating_profit"] < 0) | (valid["profit_rate"] < 5)].copy()
    _risk_pool["_is_loss"] = (_risk_pool["operating_profit"] < 0).astype(int)
    risk = (
        _risk_pool
        .sort_values(["_is_loss", "profit_rate"], ascending=[False, True])
        .head(5)
        .drop(columns=["_is_loss"])
    )
    if not risk.empty:
        elements.append(Paragraph("리스크 프로젝트 (손실·이익율 5% 미만)", sub_style))
        risk_data = [["프로젝트코드", "파트", "단계", "경상이익", "이익율"]]
        loss_rows = []
        for i, (_, row) in enumerate(risk.iterrows(), start=1):
            risk_data.append([
                wrap_code(row["project_code"]), row["part"], row["stage"],
                f"{row['operating_profit']/1e8:.1f}억원",
                f"{round(row['profit_rate'], 1)}%",
            ])
            if row["operating_profit"] < 0:
                loss_rows.append(i)
        t4 = Table(risk_data, colWidths=PROJECT_COL_W, repeatRows=1)
        _style = tbl_style(left_align_col0=True)
        LOSS_RED = colors.HexColor("#DC2626")
        for r in loss_rows:
            _style.add("TEXTCOLOR", (0, r), (-1, r), LOSS_RED)
        t4.setStyle(_style)
        elements += [t4, Spacer(1, 6*mm)]

    doc.build(elements)
    buffer.seek(0)

    raw_name     = f"재무현황_{datetime.now().strftime('%Y%m%d')}.pdf"
    encoded_name = quote(raw_name.encode("utf-8"), safe="._-")
    response = make_response(buffer.read())
    response.headers["Content-Type"] = "application/pdf"
    response.headers["Content-Disposition"] = (
        f'attachment; filename="report.pdf"; filename*=UTF-8\'\'{encoded_name}'
    )
    return response
