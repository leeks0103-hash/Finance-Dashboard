# 진단용 — 신사업기획파트/전동화&차량개발교육파트 표 구조·코드 충돌 스캔 (일회성, 커밋 대상 아님)
import io
import os
import sys
from collections import defaultdict
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import extract_financial_ppt as fin
import extract_kpi_ppt as kpi

TARGET_FOLDERS = [
    r"C:\Users\aaa\Desktop\기술교육실_프로젝트 보고서 수집\신사업기획파트",
    r"C:\Users\aaa\Desktop\기술교육실_프로젝트 보고서 수집\전동화&차량개발교육파트",
]


def find_pptx_files(folder):
    out = []
    for root, _, files in os.walk(folder):
        for name in files:
            if name.lower().endswith((".pptx", ".ppt")) and not fin.is_temp_or_hidden_office_file(name):
                out.append(os.path.join(root, name))
    return sorted(out)


all_files = []
for f in TARGET_FOLDERS:
    all_files.extend(find_pptx_files(f))

print(f"총 대상 파일 수: {len(all_files)}")

# ---------------- 재무 표 추출 ----------------
fin_results = []
ppt_app = fin.create_powerpoint_app()
try:
    for path in all_files:
        try:
            rows = fin.extract_financial_rows_from_ppt(ppt_app, path)
            fin_results.append({"file": path, "rows": rows, "error": None})
        except Exception as e:
            fin_results.append({"file": path, "rows": [], "error": str(e)})
finally:
    try:
        ppt_app.Quit()
    except Exception:
        pass

# ---------------- KPI 표 추출 (구조 검사 포함) ----------------
kpi_results = []
for path in all_files:
    p = Path(path)
    try:
        from pptx import Presentation
        meta = kpi.get_file_meta(p)
        recs = kpi.extract_records_from_ppt(p, meta)

        # 구조 검사: 키워드 매칭 슬라이드의 표 크기 직접 확인 (row/col 표준과 다른지)
        shapes_info = []
        try:
            prs = Presentation(str(path))
            for slide in prs.slides:
                if kpi.slide_contains_keyword(slide, kpi.TITLE_KEYWORD):
                    for table in kpi.get_all_tables(slide):
                        shapes_info.append((len(table.rows), len(table.columns)))
        except Exception:
            pass

        kpi_results.append({"file": path, "records": recs, "error": None, "shapes": shapes_info})
    except Exception as e:
        kpi_results.append({"file": path, "records": [], "error": str(e), "shapes": []})

# ================= 분석 =================
print("\n" + "=" * 70)
print("[1] 재무 추출 오류 (표 구조 이상 등)")
print("=" * 70)
for r in fin_results:
    if r["error"]:
        print(f"  ERROR: {os.path.basename(r['file'])}\n         -> {r['error']}")
    if not r["error"] and not r["rows"]:
        print(f"  표 없음/키워드 불일치: {os.path.basename(r['file'])}")

print("\n" + "=" * 70)
print("[2] KPI 추출 오류 / 표 구조 이상 (표준: rows=9, cols=8)")
print("=" * 70)
for r in kpi_results:
    if r["error"]:
        print(f"  ERROR: {os.path.basename(r['file'])}\n         -> {r['error']}")
        continue
    for (rows_n, cols_n) in r["shapes"]:
        if rows_n != 9 or cols_n != 8:
            print(f"  구조 이상 rows={rows_n} cols={cols_n}: {os.path.basename(r['file'])}")
    if not r["shapes"]:
        print(f"  KPI 슬라이드/표 없음: {os.path.basename(r['file'])}")

print("\n" + "=" * 70)
print("[3] 재무 - 구분(표 내용) vs 파일명 단계 불일치")
print("=" * 70)
STAGE_LIST = ["사전검토", "착수", "중간", "완료보고", "완료", "제안"]
def stage_from_filename(name):
    for s in STAGE_LIST:
        if s in name:
            return s
    return None

for r in fin_results:
    fname = os.path.basename(r["file"])
    fstage = stage_from_filename(fname)
    for row in r["rows"]:
        table_stage = fin.normalize_text(row[3])
        if fstage and table_stage and fstage not in table_stage and table_stage not in fstage:
            print(f"  불일치: 파일={fname} / 파일명단계={fstage} / 표내용구분='{table_stage}'")

print("\n" + "=" * 70)
print("[4] 재무 - 코드 충돌 (같은 코드+연도+파트+구분, 다른 프로젝트 파일명)")
print("=" * 70)
fin_keys = defaultdict(set)
for r in fin_results:
    fname = os.path.basename(r["file"])
    base = fin.strip_stage_suffix(fname)
    for row in r["rows"]:
        code, year, part, stage = fin.normalize_text(row[0]), row[1], row[2], fin.normalize_text(row[3])
        if code in fin.PLACEHOLDER_CODES:
            continue
        fin_keys[(code, year, part, stage)].add(base)

for k, bases in fin_keys.items():
    if len(bases) > 1:
        print(f"  코드={k[0]} 연도={k[1]} 파트={k[2]} 구분={k[3]} -> 서로 다른 프로젝트: {sorted(bases)}")

print("\n" + "=" * 70)
print("[5] KPI - 코드 충돌 (같은 코드+연도+단계, 다른 프로젝트 파일명)")
print("=" * 70)
kpi_keys = defaultdict(set)
for r in kpi_results:
    fname = os.path.basename(r["file"])
    base = kpi.strip_stage_suffix(fname)
    for rec in r["records"]:
        code, year, stage = kpi.normalize_text(rec[0]) if hasattr(kpi, "normalize_text") else rec[0], rec[1], rec[3]
        if code in kpi.PLACEHOLDER_CODES:
            continue
        kpi_keys[(code, year, stage)].add(base)

for k, bases in kpi_keys.items():
    if len(bases) > 1:
        print(f"  코드={k[0]} 연도={k[1]} 단계={k[2]} -> 서로 다른 프로젝트: {sorted(bases)}")

print("\n완료.")
