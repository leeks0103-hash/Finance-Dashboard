# API 스펙

> 2026-10-22 현재 코드 기준으로 다시 정리(예전 문서는 Jinja 메인 페이지·재무 API 몇 개만 있던 초기 구조). 전체 목록은
> `python -c "from app import app; [print(r) for r in app.url_map.iter_rules()]"` 로도 확인할 수 있다.
> 숫자 규칙(단위·집계 방식)은 CLAUDE.md "데이터 규칙"이 기준.

## 공통 규칙

- **로그인**: 관리자 기능의 "로그인 요구" 설정(`data/access.json`, 기본 켜짐)이 켜져 있으면 `/api/*`는 로그인 토큰 없이는 401.
  토큰은 헤더 `X-Extract-Key`(다운로드 링크는 `?token=`). 로그인 없이 부를 수 있는 것: `POST /api/auth/login`, `GET /api/auth/me`,
  `GET /api/settings/access`, 캐시 다시 읽기 3개(`/api/reload`·`/api/kpi/reload`·`/api/performance/reload`).
- **관리자 전용**: 표의 "관리자" 표시 — 일반 회원·미로그인은 403. 로그인 요구가 꺼져 있어도 관리자 전용은 그대로 403.
- **금액 단위**: 재무(`/api/data`·`/api/summary` 등) 원 · 실적현황(`/api/performance/*`) 천원 · 화면 표시용 억 변환은 프론트.
- **서버 페이지 표**(`/api/data`·`/api/kpi/data`·`/api/performance/data`): `page`·`page_size`·`search`·`field`·`sort_by`·`sort_dir`를 받고
  `{ data: [...], total }`을 돌려준다(정렬은 페이지를 자르기 전 전체 기준).
- 오류 응답은 `{ "ok": false, "error": "..." }` 꼴.

## 인증

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/auth/login` | `{emp_no, password}` → `{token, emp_no, name, role}` (role = admin / user) |
| GET | `/api/auth/me` | 저장된 토큰이 아직 유효한지 + 역할 |

## 재무 (`finance.py`)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/data` | 재무 원본 행(서버 페이지). 필터 `year`·`part`·`stage`(복수 가능), 검색 `search`+`field` |
| GET | `/api/summary` | 집계(합계·파트별·보고단계별·원가 구성, 파트별 이익율·지출/이익 비율 포함) |
| GET | `/api/summary/breakdown` | 차트 막대/조각 하나가 어떤 프로젝트 행의 합인지(`field`·`dim`·`key`) — 드릴다운 |
| GET | `/api/insights` | 이익율 상위 / 저수익·손실 / 코멘트 |
| GET | `/api/finance/missed-bid` | 미수주 프로젝트(비고의 `[미수주]` 태그) |
| GET | `/api/finance/codes` | 재무 이력이 있는 프로젝트코드 → 건수(실적 표의 숫자 배지용) |
| POST | `/api/finance/open-file` | 처리이력 기준으로 서버 PC에서 원본 PPT(또는 폴더) 열기 |
| POST | `/api/reload` | 재무 엑셀 캐시 다시 읽기(로그인 불필요) |
| GET | `/api/export/pdf` | 현재 필터 기준 PDF |

`/api/data` 행 필드는 `docs/data-schema.md`.

## KPI (`kpi.py`)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/kpi/data` | KPI 취합 행(서버 페이지) |
| GET | `/api/kpi/options` | 필터 옵션 |
| GET | `/api/kpi/summary` | KPI 집계(정식 코드·같은 코드+연도는 가장 진행된 단계 1건, 합계/평균 규칙은 CLAUDE.md) |
| GET | `/api/kpi/summary/breakdown` | KPI 집계 값의 산출 근거 프로젝트 목록 |
| POST | `/api/kpi/open-file` | 원본 PPT(또는 폴더) 열기 |
| POST | `/api/kpi/reload` | 캐시 다시 읽기(로그인 불필요) |

## 경영실적 (`performance.py`)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/performance/summary` | 집계 — 기준월(`base`)·합계·파트별·월별·원가 구성·진행률 등 (필터 `part`·`team`) |
| GET | `/api/performance/summary/breakdown` | 차트 막대 하나의 산출 근거(`chart`·`series`·`key`) |
| GET | `/api/performance/options` | 팀·파트·담당자 옵션 |
| GET | `/api/performance/data` | 프로젝트 상세(프로젝트당 1행, 서버 페이지). 필터 `part`·`team`·`progress`·열 필터 `cf`(JSON) |
| GET | `/api/performance/data/export` | 프로젝트 상세 엑셀(같은 필터·정렬, 전체 페이지, 배지 포함) |
| GET | `/api/performance/insights` | 목표 대비 부진·손실 저수익·코멘트 |
| GET | `/api/performance/fin-mismatch` | **관리자** 완료 프로젝트 중 실적↔재무 이력 매출·직접원가 상이 목록 |
| GET | `/api/performance/update-status` | **관리자** 새 실적 파일 자동 반영 상태(열 맞춤·계산식 검증 결과) |
| POST | `/api/performance/update-status/retry` | **관리자** 실패한 파일 다시 시도 |
| POST | `/api/performance/upload` | **관리자** 실적 엑셀을 `data/`에 올리기 |
| POST | `/api/performance/reload` | 캐시 다시 읽기(로그인 불필요) |

## 설정 (`app.py`) — 서버 저장(`data/*.json`, git 제외)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET / PUT | `/api/settings/access` | 로그인 요구 켬/끔 `{loginRequired}` — GET은 누구나, PUT은 **관리자** |
| GET / PUT | `/api/settings/visibility` | 기능별 공개 범위(all/admin/none): `fileOpen`·`folderOpen`·`achieveRate`·`aiInsight`·`extractRequest` — PUT은 **관리자** |
| GET / PUT | `/api/settings/perf-update` | 실적 탭 "경영실적 현황 업데이트" 칸(라벨·날짜) — PUT은 **관리자** |

## PPT 추출·데이터 이상 (`app.py`, `extract_coverage.py`, `extract_requests.py`)

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/extract/run` | **관리자** 추출 시작 `{targets, mode: incremental/selected/reset/failed, files?}` |
| GET | `/api/extract/status` | 추출 진행 상태 |
| POST | `/api/extract/cancel` | **관리자** 진행 중 추출 중지 |
| GET | `/api/extract/coverage` | **관리자** 추출 현황(원본 폴더 파일 수 vs 추출된 것, 안 된 이유) |
| POST | `/api/extract/open-file` | **관리자** 추출 현황 목록의 원본 열기 |
| GET | `/api/data-health` | 데이터 이상 배지(KPI↔재무 코드 충돌·완료 보고 이상 등) |
| POST | `/api/data-health/ack` | `{file, done}` "수정 완료" 표시(로그인한 누구나) |
| POST | `/api/extract-requests/check` · `/api/extract-requests` | 업데이트(재추출) 요청 확인 / 남기기(로그인한 누구나) |
| GET | `/api/extract-requests` | **관리자** 남은 요청 목록 |
| POST | `/api/extract-requests/dismiss` | **관리자** 요청 지우기 |

## 다운로드·AI·시크릿 키 메일

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/download` · `/api/download/<key>` | 받을 수 있는 엑셀 목록 / 파일(프로젝트 상세는 받을 때 새로 생성) |
| GET | `/api/ai/finance` · `/api/ai/kpi` | H-Chat 분석문(캐시 `data/ai_analysis_cache.json`, `?force=1` 재분석). **1회 90~100초** 걸림 |
| GET | `/api/secret-mail` | **관리자** 명단 + 보낸 기록 + 보내는 계정(키는 응답에 없음) |
| GET | `/api/secret-mail/account-diff` | **관리자** 명단 엑셀 vs `.env` 일반 회원 대조(읽기만) |
| GET | `/api/secret-mail/preview?emp=` | **관리자** 그 사람에게 갈 메일 그대로(키만 가림) |
| POST | `/api/secret-mail/send` | **관리자** `{mode: all}` 또는 `{mode: selected, emps}` — Outlook으로 한 사람씩 |
| GET / POST | `/api/secret-mail/status` · `/cancel` | **관리자** 발송 진행 상태 / 중지 |
