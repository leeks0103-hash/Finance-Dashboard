"""
실적(사업계획 통합관리) 엑셀의 월별 시트 헤더를 컬럼 인덱스와 함께 출력.

매달 새 시트가 추가되면 컬럼 배치가 바뀔 수 있어 app.py의 _PERF_COL_MAPS를
직접 손으로 갱신해야 한다. 이 스크립트로 헤더를 먼저 확인한 뒤 매핑하면
"엉뚱한 컬럼값이 조용히 들어가는" 사고를 미리 잡을 수 있다.

사용법:
    python scripts/check_perf_headers.py "<엑셀 경로>" "<시트명>"
    python scripts/check_perf_headers.py "<엑셀 경로>" "<시트명A>" "<시트명B>"  # 두 시트 나란히 비교
"""
import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd

if len(sys.argv) < 3:
    print("사용법: python check_perf_headers.py <엑셀경로> <시트명> [<비교시트명>]")
    sys.exit(1)

path = sys.argv[1]
sheets = sys.argv[2:]


def read_headers(path, sheet):
    df = pd.read_excel(path, sheet_name=sheet, header=None, skiprows=10, nrows=3)
    labels = []
    for c in range(df.shape[1]):
        vals = [str(df.iloc[r, c]).replace("\n", " ") for r in range(3) if pd.notna(df.iloc[r, c])]
        labels.append(" / ".join(vals))
    return labels


headers_by_sheet = {s: read_headers(path, s) for s in sheets}

if len(sheets) == 1:
    for i, label in enumerate(headers_by_sheet[sheets[0]]):
        print(f"col{i}: {label}")
else:
    max_len = max(len(v) for v in headers_by_sheet.values())
    print(f"{'idx':<5}" + "".join(f"{s:<55}" for s in sheets))
    for i in range(max_len):
        row = [headers_by_sheet[s][i] if i < len(headers_by_sheet[s]) else "" for s in sheets]
        print(f"{i:<5}" + "".join(f"{v[:52]:<55}" for v in row))
