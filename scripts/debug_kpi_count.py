import sys
sys.path.insert(0, r'D:\ngv_dashbord\Finance-Dashboard')
from kpi import load_kpi_excel, _kpi_cache_lock
import kpi

with _kpi_cache_lock:
    load_kpi_excel()

ded = kpi._kpi_dedup_df

# 신규/기존 건수 관련 컬럼 찾기
cnt_cols = [c for c in ded.columns if '신규기존' in c or '신사업' in c]
print('관련 컬럼:', cnt_cols)
print()

for col in cnt_cols:
    vals = ded[col].dropna().astype(str)
    non_zero = vals[~vals.isin(['0', '0.0', 'nan', ''])]
    print(f'[{col}] 비어있지 않은 값 (상위 10):')
    print(non_zero.head(10).to_string())
    print()
