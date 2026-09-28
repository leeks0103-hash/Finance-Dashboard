import sys
sys.path.insert(0, r'D:\ngv_dashbord\Finance-Dashboard')

from kpi import load_kpi_excel, _kpi_cache_lock, _aggregate_kpi_col, _load_kpi_items_from_cache
import kpi

with _kpi_cache_lock:
    load_kpi_excel()

raw = kpi._kpi_raw_df
ded = kpi._kpi_dedup_df

print(f"raw 행수: {len(raw)}")
print(f"dedup 행수: {len(ded)}")
print()

items = _load_kpi_items_from_cache()
actuals_raw = []
actuals_ded = []

# _kpi_dedup_df를 임시로 raw로 교체해서 raw 기준 집계
kpi._kpi_dedup_df = raw
a_raw = _aggregate_kpi_col(items, 'PJ실적')
t_raw = _aggregate_kpi_col(items, 'PJ목표')

# 다시 dedup으로 복원
kpi._kpi_dedup_df = ded
a_ded = _aggregate_kpi_col(items, 'PJ실적')
t_ded = _aggregate_kpi_col(items, 'PJ목표')

print("항목                               | raw 실적 | dedup 실적 | raw 목표 | dedup 목표")
print("-" * 95)
for i, item in enumerate(items):
    name = item['name'][:40]
    ar = a_raw[i] if i < len(a_raw) else '-'
    ad = a_ded[i] if i < len(a_ded) else '-'
    tr = t_raw[i] if i < len(t_raw) else '-'
    td = t_ded[i] if i < len(t_ded) else '-'
    changed = " ★" if ar != ad or tr != td else ""
    print(f"{name:<40} | {str(ar):<8} | {str(ad):<10} | {str(tr):<8} | {str(td):<10}{changed}")
