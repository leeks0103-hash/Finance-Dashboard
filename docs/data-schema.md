# 데이터 스키마

> 2026-10-22 현재 코드 기준으로 다시 정리. 실적현황·KPI의 열 위치·단위·검증식은 CLAUDE.md "데이터 규칙"이 기준이고,
> 여기엔 재무 시트 열과 서버가 쓰는 파일 목록만 둔다. 경로는 `paths.py`가 한 곳에서 정한다(.env `EXCEL_PATH` 등 우선).

## 데이터 파일 (`data/`, 전부 git 제외)

| 파일 | 만드는 쪽 | 읽는 쪽 |
|---|---|---|
| `재무관점 필수 데이터 추출.xlsx` (시트 `취합`) | `scripts/extract_financial_ppt.py` | `finance.py` |
| `KPI 지표 데이터 추출.xlsx` | `scripts/extract_kpi_ppt.py` | `kpi.py` |
| `*사업계획 통합관리 파일*.xlsx` | 회사 파일을 `data/`에 넣기만 | `performance.py` + `perf_autoupdate.py` |
| `사용자 목록/현대엔지비사용자목록_*.xlsx` | 직접 넣음(이름순 마지막 파일) | `secret_mail.py` · `scripts/fill_user_accounts.py` |
| `*.json` (설정·상태·기록) | 서버 | 서버 — `headcount`(파트별 인원, 관리자 수기)·`access`(로그인 요구)·`visibility`(공개 범위)·`perf_update`·`perf_update_status`·`perf_col_maps`·`health_ack`·`extract_requests`·`secret_mail_sent`·`ai_analysis_cache` |

⚠ 재무·KPI 엑셀을 Excel로 열지 말 것(AIP 레이블이 붙어 암호화되면 openpyxl이 못 읽음) — CLAUDE.md 참고.

## 재무 시트 `취합` — 16열 (`finance.EXCEL_COLS`)

1행 머리글, 데이터 2행부터. 금액은 **원** 단위.

| 열 | 필드명 | 타입 | 설명 |
|---|---|---|---|
| 1 | `project_code` | str | 프로젝트 코드 |
| 2 | `year` | str | 연도 |
| 3 | `part` | str | 파트명 |
| 4 | `stage` | str | 보고단계(검토 → 사업계획 → 사전검토 → 제안 → 착수 → 중간 → 완료 → 추가제안 → 추가중간 → 추가완료) |
| 5 | `revenue` | float | 매출 |
| 6 | `expenditure` | float | 지출 |
| 7 | `direct_cost` | float | 직접원가 |
| 8 | `labor_cost` | float | 직접인건비 |
| 9 | `overhead` | float | 공통원가 |
| 10 | `operating_profit` | float | 경상이익 |
| 11 | `profit_rate` | float | 이익율(%) |
| 12 | `note` | str | 비고(`[미수주]` 태그가 있으면 미수주 프로젝트) |
| 13 | `filename` | str | 원본 PPT 파일명 |
| 14 | `processed_at` | str | 처리일 |
| 15 | `reflected_at` | str | 반영일 |
| 16 | `missed_bid_reason` | str | 미수 사유(PPT의 "★ 미수 사유" 텍스트박스) |

## 처리 규칙

- 숫자 필드의 `None`은 `0`, `%`·`,`는 제거 후 float 변환(`pd.to_numeric`).
- 프로젝트코드가 **빈 값**인 행만 읽을 때 제외. `0`·숫자만·"생성 예정" 같은 임시 코드 행은 `/api/data`·`/api/summary`에 그대로 들어가고,
  이익율 상위/저수익 랭킹(`/api/insights`)에서만 임시·미배정 코드를 뺀다(`shared.is_ranked_valid_code`).
- 이익율 절댓값이 200%를 넘으면 매출 기준으로 다시 계산(보정 건수는 로그 경고 — 추출 스크립트 점검용).
- 완료 보고 PPT는 매출·직접원가만 채움 — 나머지 0은 '값 없음'(화면 회색).
- 메모리 캐시를 엑셀 수정 시각(mtime)으로 자동 갱신하고, `/api/reload`는 즉시 다시 읽기.
- 행 순서는 추출 순이 아니라 보고단계 순서(같은 단계끼리는 추출 순 유지).
