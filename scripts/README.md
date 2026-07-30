# 데이터 추출 스크립트

PPT 파일에서 데이터를 추출해 엑셀로 저장하는 스크립트 모음입니다.

## 실행 순서

```
PPT 파일 → (스크립트 실행) → Excel 파일 → 대시보드 반영
```

## 스크립트별 역할

| 파일 | 역할 | 출력 엑셀 |
|------|------|-----------|
| `extract_financial_ppt.py` | PPT에서 재무 데이터 추출 | `재무관점 필수 데이터 추출.xlsx` |
| `extract_kpi_ppt.py` | PPT에서 KPI 데이터 추출 | `KPI 지표 데이터 추출.xlsx` |
| `file_compare.py` | NAS ↔ 로컬 PPT 파일 비교 리포트 | `compare_report.xlsx` |

## 실행 방법

```powershell
# 재무 데이터 추출
python scripts/extract_financial_ppt.py

# KPI 데이터 추출
python scripts/extract_kpi_ppt.py

# 파일 비교
python scripts/file_compare.py
```

## 주의사항

- `extract_financial_ppt.py` — `ROOT_DIR`, `TARGET_EXCEL` 경로 확인 필요
- `extract_kpi_ppt.py` — `ROOT_DIR` 경로 확인 필요 (현재 깊이 제한 `MAX_SEARCH_DEPTH=2`)
- PPT 파일은 `.pptx` 형식만 지원 (`.ppt`는 먼저 변환 필요)
