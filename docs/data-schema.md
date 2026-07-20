# 데이터 스키마

## 엑셀 파일 구조

**파일 경로**: `D:/24.기술교육사업기획팀/.../재무관점 필수 데이터 추출.xlsx`
> 다른 환경에서 사용 시 `app.py` 8~13줄의 `EXCEL_PATH` 직접 수정 필요

**시트명**: `취합`
**데이터 시작**: 2행 (1행은 헤더)

## 컬럼 매핑

| 인덱스 | 필드명 | 타입 | 설명 |
|--------|--------|------|------|
| r[0] | `project_code` | str | 프로젝트 코드 |
| r[1] | `year` | str | 연도 |
| r[2] | `part` | str | 파트명 |
| r[3] | `stage` | str | 보고단계 |
| r[4] | `revenue` | float | 매출 (원) |
| r[5] | `expenditure` | float | 지출 (원) |
| r[6] | `direct_cost` | float | 직접원가 (원) |
| r[7] | `labor_cost` | float | 직접인건비 (원) |
| r[8] | `overhead` | float | 공통원가/관리비 (원) |
| r[9] | `operating_profit` | float | 경상이익 (원) |
| r[10] | `profit_rate` | float | 이익율 (%) |
| r[11] | `note` | str | 비고 |
| r[12] | `filename` | str | 원본 파일명 |
| r[13] | `processed_at` | str | 처리일 |
| r[14] | `reflected_at` | str | 반영일 |

## 데이터 처리 규칙
- `None` 값은 숫자 필드에서 `0`으로 처리 (`safe_num` 함수)
- `%`, `,` 문자 제거 후 float 변환
- `r[0]`이 비어있는 행은 스킵
- 데이터는 메모리 캐시(`_cached_data`)에 보관, `/api/reload`로 갱신
