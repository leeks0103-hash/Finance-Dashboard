import csv, sys
sys.stdout.reconfigure(encoding='utf-8')
with open(r'D:\ngv_dashbord\Finance-Dashboard\data\manual_tree.csv', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))

print(f"전체 행: {len(rows)}")
folders = [r for r in rows if r['유형'] == '폴더' and int(r['깊이']) <= 2]
print(f"\n=== 깊이 0~2 폴더 ({len(folders)}개) ===")
for r in folders:
    indent = '  ' * int(r['깊이'])
    print(f"{indent}[깊이{r['깊이']}] {r['Name']}")
