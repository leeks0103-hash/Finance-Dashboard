import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.formatting.rule import CellIsRule

import finance, performance

PART_MAP = {
    'AI': '① AIㆍDS', 'SW': '② SW', '전차': '③ 전동화ㆍ차량개발',
    '미모': '④ 미래모빌리티', '신사업': '⑤ 신사업', 'PM': '⑥ PM', 'K뉴딜TF': '⑦ K뉴딜TF',
}

fdf = finance.get_df()
fdf26 = fdf[fdf['year'] == '2026'].copy()

pdf = performance.get_perf_df()

FONT = 'Arial'
HEADER_FILL = PatternFill('solid', start_color='1F2937')
HEADER_FONT = Font(name=FONT, bold=True, color='FFFFFF', size=10)
TITLE_FONT = Font(name=FONT, bold=True, size=13)
NOTE_FONT = Font(name=FONT, italic=True, size=9, color='6B7280')
THIN = Side(style='thin', color='D1D5DB')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WARN_FILL = PatternFill('solid', start_color='FEF3C7')
BAD_FILL = PatternFill('solid', start_color='FEE2E2')

DATA_FONT = Font(name=FONT, size=10)

wb = Workbook()

# ── Sheet 1: 재무 원본(2026) ──────────────────────────────
ws1 = wb.active
ws1.title = '재무_원본(2026)'
cols1 = ['project_code', 'part', 'revenue', 'expenditure', 'direct_cost', 'labor_cost', 'overhead', 'operating_profit', 'profit_rate']
headers1 = ['프로젝트코드', '파트', '매출', '지출', '직접원가', '인건비', '공통원가', '경상이익', '이익율(%)']
for j, h in enumerate(headers1, 1):
    c = ws1.cell(1, j, h)
    c.font = HEADER_FONT
    c.fill = HEADER_FILL
for i, (_, row) in enumerate(fdf26[cols1].iterrows(), 2):
    for j, col in enumerate(cols1, 1):
        ws1.cell(i, j, row[col]).font = DATA_FONT
for j in range(1, len(cols1) + 1):
    ws1.column_dimensions[get_column_letter(j)].width = 16
ws1.freeze_panes = 'A2'

# ── Sheet 2: 실적 원본 ────────────────────────────────────
ws2 = wb.active.parent.create_sheet('실적_원본')
cols2 = ['project_code', 'part', 'category', 'jun_actual', 'cost_direct', 'cost_labor', 'cost_overhead', 'operating_profit', 'profit_rate']
headers2 = ['프로젝트코드', '파트', '구분', '7월실적(천원)', '직접원가', '인건비', '공통원가', '경상이익', '이익율(%)']
for j, h in enumerate(headers2, 1):
    c = ws2.cell(1, j, h)
    c.font = HEADER_FONT
    c.fill = HEADER_FILL
for i, (_, row) in enumerate(pdf[cols2].iterrows(), 2):
    for j, col in enumerate(cols2, 1):
        ws2.cell(i, j, row[col]).font = DATA_FONT
for j in range(1, len(cols2) + 1):
    ws2.column_dimensions[get_column_letter(j)].width = 16
ws2.freeze_panes = 'A2'

n1 = len(fdf26) + 1
n2 = len(pdf) + 1

# ── Sheet 3: 파트별 비교 ──────────────────────────────────
ws3 = wb.create_sheet('파트별_비교', 0)
ws3['A1'] = '재무(PPT) vs 실적현황(원본) 파트별 비교 — 2026년'
ws3['A1'].font = TITLE_FONT
ws3.merge_cells('A1:J1')
ws3['A2'] = '※ 재무 탭은 PPT 추출본(담당자 수기 입력), 실적현황 탭은 26년 사업계획 통합관리 파일(신뢰 원본) 기준. 단위 억원.'
ws3['A2'].font = NOTE_FONT
ws3.merge_cells('A2:J2')

headers3 = ['파트', '재무 매출(억)', '실적 매출(억)', '매출 차이(억)', '매출 차이율(%)',
            '재무 이익율(%)', '실적 이익율(%)', '이익율 차이(%p)', '재무 건수', '실적 건수']
for j, h in enumerate(headers3, 1):
    c = ws3.cell(4, j, h)
    c.font = HEADER_FONT
    c.fill = HEADER_FILL
    c.alignment = Alignment(horizontal='center', wrap_text=True)

row = 5
for fp, pp in PART_MAP.items():
    ws3.cell(row, 1, fp)
    # 재무 매출(억)
    ws3.cell(row, 2, f"=SUMIF('재무_원본(2026)'!B2:B{n1},A{row},'재무_원본(2026)'!C2:C{n1})/100000000")
    # 실적 매출(억) — 매출 카테고리만, jun_actual 단위=천원
    ws3.cell(row, 3, f"=SUMIFS('실적_원본'!D2:D{n2},'실적_원본'!B2:B{n2},\"{pp}\",'실적_원본'!C2:C{n2},\"매출\")/100000")
    # 매출 차이(억) / 차이율(%)
    ws3.cell(row, 4, f"=C{row}-B{row}")
    ws3.cell(row, 5, f"=IF(B{row}=0,\"\",D{row}/B{row}*100)")
    # 재무 이익율 — 양수 행만 평균
    ws3.cell(row, 6, f"=IFERROR(AVERAGEIFS('재무_원본(2026)'!I2:I{n1},'재무_원본(2026)'!B2:B{n1},A{row},'재무_원본(2026)'!I2:I{n1},\">0\"),0)")
    # 실적 이익율 — 매출 카테고리, 양수 행만 평균
    ws3.cell(row, 7, f"=IFERROR(AVERAGEIFS('실적_원본'!I2:I{n2},'실적_원본'!B2:B{n2},\"{pp}\",'실적_원본'!C2:C{n2},\"매출\",'실적_원본'!I2:I{n2},\">0\"),0)")
    ws3.cell(row, 8, f"=G{row}-F{row}")
    ws3.cell(row, 9, f"=COUNTIF('재무_원본(2026)'!B2:B{n1},A{row})")
    ws3.cell(row, 10, f"=COUNTIFS('실적_원본'!B2:B{n2},\"{pp}\",'실적_원본'!C2:C{n2},\"매출\")")
    row += 1

total_row = row
ws3.cell(total_row, 1, '합계/전체').font = Font(name=FONT, bold=True)
ws3.cell(total_row, 2, f"=SUM(B5:B{row-1})")
ws3.cell(total_row, 3, f"=SUM(C5:C{row-1})")
ws3.cell(total_row, 4, f"=C{total_row}-B{total_row}")
ws3.cell(total_row, 5, f"=IF(B{total_row}=0,\"\",D{total_row}/B{total_row}*100)")
ws3.cell(total_row, 6, f"=IFERROR(AVERAGEIF('재무_원본(2026)'!I2:I{n1},\">0\"),0)")
ws3.cell(total_row, 7, f"=IFERROR(AVERAGEIFS('실적_원본'!I2:I{n2},'실적_원본'!C2:C{n2},\"매출\",'실적_원본'!I2:I{n2},\">0\"),0)")
ws3.cell(total_row, 8, f"=G{total_row}-F{total_row}")
ws3.cell(total_row, 9, f"=SUM(I5:I{row-1})")
ws3.cell(total_row, 10, f"=SUM(J5:J{row-1})")

for r in range(5, total_row + 1):
    for c in range(1, 11):
        cell = ws3.cell(r, c)
        cell.border = BORDER
        cell.font = Font(name=FONT, size=10, bold=(r == total_row))
        if c in (2, 3, 4):
            cell.number_format = '#,##0.0'
        if c == 5:
            cell.number_format = '#,##0.0"%"'
        if c in (6, 7):
            cell.number_format = '#,##0.0"%"'
        if c == 8:
            cell.number_format = '#,##0.0"%p"'

# 조건부 서식 — |매출 차이율| 20% 이상, |이익율 차이| 5%p 이상만 강조 (정적 색칠 대신 실제 이상치만 표시)
ws3.conditional_formatting.add(
    f'E5:E{total_row}',
    CellIsRule(operator='greaterThan', formula=['20'], fill=WARN_FILL),
)
ws3.conditional_formatting.add(
    f'E5:E{total_row}',
    CellIsRule(operator='lessThan', formula=['-20'], fill=BAD_FILL),
)
ws3.conditional_formatting.add(
    f'H5:H{total_row}',
    CellIsRule(operator='greaterThan', formula=['5'], fill=BAD_FILL),
)
ws3.conditional_formatting.add(
    f'H5:H{total_row}',
    CellIsRule(operator='lessThan', formula=['-5'], fill=BAD_FILL),
)

for j, w in enumerate([10, 14, 14, 14, 14, 14, 14, 14, 10, 10], 1):
    ws3.column_dimensions[get_column_letter(j)].width = w

# ── Sheet 4: 원가구성 비교 ────────────────────────────────
ws4 = wb.create_sheet('원가구성_비교', 1)
ws4['A1'] = '원가 구성 비교 (2026년, 억원)'
ws4['A1'].font = TITLE_FONT
ws4.merge_cells('A1:E1')

headers4 = ['항목', '재무(억)', '재무 비중(%)', '실적(억)', '실적 비중(%)']
for j, h in enumerate(headers4, 1):
    c = ws4.cell(3, j, h)
    c.font = HEADER_FONT
    c.fill = HEADER_FILL

items = [
    ('직접원가', "'재무_원본(2026)'!E", "'실적_원본'!E"),
    ('인건비',   "'재무_원본(2026)'!F", "'실적_원본'!F"),
    ('공통원가', "'재무_원본(2026)'!G", "'실적_원본'!G"),
]
r = 4
for label, fcol, pcol in items:
    ws4.cell(r, 1, label)
    ws4.cell(r, 2, f"=SUM({fcol}2:{fcol}{n1})/100000000")
    ws4.cell(r, 4, f"=SUMIFS({pcol}2:{pcol}{n2},'실적_원본'!C2:C{n2},\"매출\")/100000")
    r += 1
sum_row = r
ws4.cell(sum_row, 1, '합계').font = Font(name=FONT, bold=True)
ws4.cell(sum_row, 2, f"=SUM(B4:B{sum_row-1})")
ws4.cell(sum_row, 4, f"=SUM(D4:D{sum_row-1})")
for rr in range(4, sum_row + 1):
    ws4.cell(rr, 3, f"=IF($B${sum_row}=0,\"\",B{rr}/$B${sum_row}*100)")
    ws4.cell(rr, 5, f"=IF($D${sum_row}=0,\"\",D{rr}/$D${sum_row}*100)")

for r in range(4, sum_row + 1):
    for c in range(1, 6):
        cell = ws4.cell(r, c)
        cell.border = BORDER
        cell.font = Font(name=FONT, size=10, bold=(r == sum_row))
        if c in (2, 4):
            cell.number_format = '#,##0.0'
        if c in (3, 5):
            cell.number_format = '0.0"%"'
for j, w in enumerate([12, 12, 14, 12, 14], 1):
    ws4.column_dimensions[get_column_letter(j)].width = w

# ── Sheet 5: 전체 총계 비교 ───────────────────────────────
ws5 = wb.create_sheet('총계_비교', 2)
ws5['A1'] = '전체 총계 비교 (2026년)'
ws5['A1'].font = TITLE_FONT
ws5.merge_cells('A1:D1')

headers5 = ['항목', '재무', '실적', '차이율(%)']
for j, h in enumerate(headers5, 1):
    c = ws5.cell(3, j, h)
    c.font = HEADER_FONT
    c.fill = HEADER_FILL

ws5['A4'] = '매출 합계(억원)'
ws5['B4'] = f"=SUM('재무_원본(2026)'!C2:C{n1})/100000000"
ws5['C4'] = f"=SUMIFS('실적_원본'!D2:D{n2},'실적_원본'!C2:C{n2},\"매출\")/100000"
ws5['D4'] = "=IF(B4=0,\"\",(C4-B4)/B4*100)"

ws5['A5'] = '경상이익 합계(억원)'
ws5['B5'] = f"=SUM('재무_원본(2026)'!H2:H{n1})/100000000"
ws5['C5'] = f"=SUMIFS('실적_원본'!H2:H{n2},'실적_원본'!C2:C{n2},\"매출\")/100000"
ws5['D5'] = "=IF(B5=0,\"\",(C5-B5)/B5*100)"

ws5['A6'] = '평균 이익율(%, 양수만)'
ws5['B6'] = f"=IFERROR(AVERAGEIF('재무_원본(2026)'!I2:I{n1},\">0\"),0)"
ws5['C6'] = f"=IFERROR(AVERAGEIFS('실적_원본'!I2:I{n2},'실적_원본'!C2:C{n2},\"매출\",'실적_원본'!I2:I{n2},\">0\"),0)"
ws5['D6'] = "=C6-B6"

for r in range(4, 7):
    for c in range(1, 5):
        cell = ws5.cell(r, c)
        cell.border = BORDER
        cell.font = DATA_FONT
        if c in (2, 3):
            cell.number_format = '#,##0.0'
        if c == 4:
            cell.number_format = '#,##0.0"%"'
for j, w in enumerate([22, 14, 14, 14], 1):
    ws5.column_dimensions[get_column_letter(j)].width = w

ws5.conditional_formatting.add('D4:D6', CellIsRule(operator='greaterThan', formula=['15'], fill=BAD_FILL))
ws5.conditional_formatting.add('D4:D6', CellIsRule(operator='lessThan', formula=['-15'], fill=BAD_FILL))

ws5['A8'] = '※ 매출 차이율은 (실적-재무)/재무. 이익율 행의 차이율(%)는 %p 차이임.'
ws5['A8'].font = NOTE_FONT

for ws in (ws3, ws4, ws5):
    ws.sheet_view.showGridLines = False

out_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', '재무_실적_비교.xlsx')
wb.save(out_path)
print('saved:', out_path)
