import csv
from collections import OrderedDict

BASE = r"Y:\1. 실 공통\2. 매뉴얼"
CSV  = r"D:\ngv_dashbord\Finance-Dashboard\data\manual_tree.csv"
MANUAL_EXT = {'.pptx','.ppt','.pdf','.docx','.doc','.xlsx','.xls','.hwp','.hwpx'}

with open(CSV, encoding='utf-8-sig') as f:
    all_rows = list(csv.DictReader(f))

rows = [r for r in all_rows
        if r['유형'] == '파일'
        and not r['Name'].startswith('~')
        and int(r['깊이']) <= 9
        and r['Extension'].lower() in MANUAL_EXT]

print(f"rows 총: {len(rows)}")

def rel_parts(full):
    rel = full.replace(BASE, '').lstrip('\\')
    return rel.split('\\')

cat_counts = {}
for r in rows:
    parts = rel_parts(r['FullName'])
    cat1 = parts[0] if len(parts) > 1 else '기타'
    cat_counts[cat1] = cat_counts.get(cat1, 0) + 1

for k, v in sorted(cat_counts.items()):
    print(f"  {k}: {v}개")

# 4.정부지원 샘플 trace
sample = next((r for r in rows if '4. 정부지원' in r['FullName']), None)
if sample:
    full = sample['FullName']
    rel = full.replace(BASE, '')
    parts = rel_parts(full)
    print()
    print("sample:", repr(full[-60:]))
    print("BASE  :", repr(BASE))
    print("rel   :", repr(rel))
    print("parts :", parts)
    print("cat1  :", parts[0] if len(parts) > 1 else '기타')
else:
    print("\n4.정부지원 파일이 rows에 없음!")
    total_gov = [r for r in all_rows if '4. 정부지원' in r['FullName'] and r['유형']=='파일']
    print(f"  CSV상 정부지원 파일 수: {len(total_gov)}")
    if total_gov:
        r0 = total_gov[0]
        print(f"  Extension: {r0['Extension']!r}")
        print(f"  깊이: {r0['깊이']!r}")
        print(f"  Name[0]: {r0['Name'][0]!r}")
