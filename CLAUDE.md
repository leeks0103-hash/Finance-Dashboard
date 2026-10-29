# Finance Dashboard — CLAUDE.md

## 프로젝트 문서
- API 스펙: @docs/api-spec.md
- 데이터 스키마: @docs/data-schema.md
- 세션 진행 기록: @docs/session-log.md
- 알려진 문제 코드: @docs/known-issues.md

## 아키텍처

```
재무·KPI : NAS PPT 보고서 → 추출 스크립트(scripts/extract_*_ppt.py) → data/*.xlsx → Flask(finance.py·kpi.py) → React
실적현황 : 회사 '사업계획 통합관리 파일' 엑셀 → data/에 넣기만 → Flask(performance.py + perf_autoupdate.py 자동 반영) → React
```

## 기술 스택
- **Backend**: Python · Flask · pandas · openpyxl · waitress / H-chat(사내 LLM, `ai_insight._call_hchat`)
- **Frontend**: Vite · React 19 · TypeScript · Zustand · TanStack Query · TanStack Table · Chart.js · react-day-picker
- **데이터**: 로컬 엑셀 3종 — 재무 `data/재무관점 필수 데이터 추출.xlsx`(시트 `취합`, 16열) ·
  KPI `data/KPI 지표 데이터 추출.xlsx` · 실적 `data/*사업계획 통합관리 파일*.xlsx`(월마다 새 파일). 자세한 규칙은 아래 "데이터 규칙"

---

## Frontend 아키텍처 규칙 (`frontend/src/`)

### 레이어 의존성 (단방향, 절대 역방향 금지)
```
types/ → utils/ → api/ → store/ → hooks/ → hooks/viewmodels/ → ui/ → features/ → pages/ → App
```

### 각 레이어 책임

| 레이어 | 책임 | 금지 사항 |
|--------|------|-----------|
| `types/` | TypeScript 인터페이스만 | 로직 없음 |
| `utils/` | 순수 함수 (formatBillion 등) | 사이드이펙트 없음 |
| `api/` | HTTP 통신만 | 변환 로직 없음 |
| `store/` | Zustand 전역 상태 | API 호출 없음, DOM 조작 없음 |
| `hooks/` | React Query data fetching | 렌더링 없음 |
| `hooks/viewmodels/` | **데이터 fetch + 변환 + null 처리 전부** | 컴포넌트 import 없음, presentation 색상 계산 없음 |
| `components/ui/` | 순수 presentational (props만) | hooks/api import 없음 |
| `components/features/` | ViewModel 호출 + ui 조합 | 비즈니스 로직 없음 |
| `layouts/` | Navbar, FilterBar 조합 | 직접 API 호출 없음 |
| `pages/` | 섹션 조합 + ErrorBoundary | 직접 API 호출 없음 |
| `App.tsx` | lazy + Suspense + 초기화 훅 관리만 | |

### 핵심 원칙: 훅이 모든 걸 책임진다

```tsx
// ❌ 컴포넌트에 로직 있으면 잘못된 것
const { data, isLoading } = useSummary();
if (isLoading || !data) return <Skeleton />;
return <KpiCard value={formatBillion(data.total_revenue)} />;

// ✅ ViewModel이 책임, 컴포넌트는 렌더링만
const vm = useKpiViewModel();
if (vm.isLoading) return <Skeleton />;
return <KpiCard value={vm.revenue} />;
```

### 버튼은 반드시 `<Button variant="...">` 사용
- `variant`: primary / danger / success / ghost
- `loading` prop으로 로딩 상태 처리
- **`<button>` 직접 사용 절대 금지** — 코드 작성 시 즉시 거부
- 단, `<select>`는 직접 사용 허용 (스타일링은 pageSize CSS class 사용)

### 상태관리 규칙
- 서버 상태 → TanStack Query (useSummary, useProjects 등)
- 클라이언트 상태 → Zustand store (filter.store, theme.store, ui.store)
- `store/` 안에서 DOM 조작·localStorage 직접 접근 금지 — `persist` 미들웨어 또는 subscribe 사용
- ViewModel이 presentation 색상(labelColor 등)을 파라미터로 받지 않음 — theme은 store에서 직접 읽기

### useMemo / useCallback 사용 규칙
- **반환 객체 리터럴 안에서 useCallback 선언은 정상** (React가 hook 순서를 함수 최상위 기준으로 판단)
- useMemo deps에 객체/배열이 들어가면 **같은 참조인지 확인** — ViewModel useMemo 결과는 stable
- string primitive는 deps에서 값 비교 → 안전
- **`useMemo` deps가 새 참조를 생성하는 경우** 메모이제이션이 무효화됨 — 주의

### key prop 규칙
- 리스트 렌더링 시 **인덱스(i) key 금지** — 내용 기반 key 사용
- 테마 전환 시 차트 리마운트가 필요한 경우 `key={theme}` 사용 (의도적)

---

## Backend 규칙 (app.py)

- `EXCEL_PATH`: `os.environ.get("EXCEL_PATH", 기본값)` — 환경변수 우선
- `load_excel()`은 프로젝트코드가 **빈 값**인 행만 제거(임시·미배정 코드 제외는 이익율 랭킹 `shared.is_ranked_valid_code`에서만) → 모든 API에서 일관성
- profit_rate 보정 시 logger.warning으로 추출 스크립트 디버깅 정보 남기기
- `_cache_lock` 보유 상태에서만 `load_excel()` 호출

---

## 데이터 규칙 — 숫자가 틀리지 않게 (반드시 지킬 것)

> 계산은 백엔드에서. 프론트는 받은 값을 단위 변환·표시만. 아래 규칙을 바꾸면 화면 숫자가 원본 엑셀과 어긋나니,
> 바꿀 땐 원본 엑셀로 직접 재계산해 대조하고 `docs/session-log.md`에 근거를 남긴다.

### 실적현황(경영실적 탭) — `performance.py`, `perf_autoupdate.py`, `paths.py`
- **파일 선택**(지금, `paths.PERF_PICK_NEWEST=True`): `data/` 바로 아래 이름에 `사업계획 통합관리 파일`이 든 `.xlsx/.xlsb` 중
  **파일명 날짜(`_yymmdd_`) 최신**, 없으면 수정 시각(`paths.perf_excel_candidates`). 하위 폴더(`경영실적 히스토리/`)·`~$` 잠금파일 제외.
  `.env PERF_EXCEL_PATH`는 data/에 후보가 없을 때만(False로 끄면 예전처럼 .env 우선)
- **시트 선택**: `YYYY년 (N월 집계|추정)` 중 (연,월) 최신, 같은 달이면 **집계 > 추정**(`_resolve_perf_sheet`)
- **기준월** = 그 시트의 N월(`summary.base`). 달력(오늘−1개월)으로 짐작하지 말 것(10-01 9월 실적이 없는데 9월로 칠해진 사고)
- **엑셀 위치**: 머리글 11~12행(`skiprows=10`, 2줄), 데이터 13행부터(`skiprows=12`). 열 번호는 0부터
- **열 매핑**(열 번호 → 필드) 우선순위: ① 코드 `_PERF_COL_MAPS[시트명]` ② 학습 맵 `data/perf_col_maps.json`
  ③ 둘 다 없으면 `perf_autoupdate.prepare`가 자동으로 만듦(아래). 매달 열이 밀릴 수 있음
  (8월: L열 '비딩여부' 삽입 / 9월: R열 'DK수정 (향후삭제)' 삽입 → `_PERF_COL_MAP_SEP` = 8월 맵에서 17 이상 +1)
- **새 파일 자동 반영 — 켜져 있음**(2026-10-15, `performance.PERF_AUTO_UPDATE`·`paths.PERF_PICK_NEWEST`·관리자 페이지(`#/admin`) > 실적현황 파일 섹션(`<PerfUpdatePanel />`)).
  끄면 새 시트가 나올 때 예전처럼 `scripts/check_perf_headers.py`로 대조해 `_PERF_COL_MAPS`에 맵을 **코드로** 추가해야 함.
  사람은 data/에 넣기만(관리자 페이지 > 실적현황 파일에 끌어다 놓기도 같음):
  1. 기준 시트 = 같은 파일 안 이미 아는 지난달 시트(없으면 직전에 잘 읽힌 파일의 시트)
  2. 머리글 글자 대조(difflib, **달·연도 숫자는 빼고 비교** "8월 점검"="9월 점검")로 열 옮김 → 못 찾은 필수 열만 H-chat이 제안
     (H-chat엔 **머리글 글자만** 보냄 — 금액·프로젝트명 등 데이터 전송 금지)
  3. **계산식 검증**(매출행, 오차 1천원, 항목별 95% 이상이어야 통과 — 9월 실측 전부 100%, 틀린 매핑은 30%대로 떨어짐):
     매출이익(BA) = 연간 합계(BH) − 직접원가(BB) / 경상손익(BF) = BA − 인건비(BC) − 공통원가(BD) − 관리비(BE) /
     BH = 1~12월 합 / 계획 대비 차이(AX) = BH − 최초사업계획(V) / 매출행 BB = 바로 아래 원가행 BH / 파트·프로젝트명 채워짐 / 매출행 50개 이상
  4. 통과 → 맵 학습·반영, 실패 → **직전 파일로 계속 표시** + 이유를 `data/perf_update_status.json`(관리자 페이지 > 실적현황 파일)에.
     실패한 파일은 안 바뀌면 다시 시도 안 함(관리자 창 "다시 시도"). 검증 기준을 느슨하게 바꾸지 말 것
- **2027 사업계획 시트 = 계획 뷰(`?view=plan27`, 2026-10-29)** — 27년 파일의 `2027년 (사업계획)` 시트. 실적 뷰(위)와 **같은 파일·같은 자동 반영 절차**(`perf_autoupdate.prepare(view=)`),
  상태는 `perf_update_status.json`의 `plan27` 키(실적 상태는 최상위 그대로, `write_status`가 뷰별로 병합 — 서로 안 지움).
  - **시트 이름**: 연도 + '계획'이 든 시트(`performance.is_plan_sheet`, N월 실적 시트 제외). `(사업계획 참조)`·`기타. 사업계획 재정리(…)` 같은 보조 시트는 안 걸림. 실적 쪽 `_resolve_perf_sheet`는 그대로(계획 시트를 실적으로 뽑지 않음)
  - **기준월·실적·누계가 없음**: 월별 값(AT~BE)은 **계획 분배**. `jun_actual`·`acc_*`는 0, 달성률·진도율·인사이트·산출 근거(breakdown)·재무 대조·인당 차트는 이 뷰에서 미지원(`/insights`는 400)
  - **열 맵** `_PERF_COL_MAP_PLAN27`(실적과 **같은 내부 필드 이름 재사용 — 의미가 다름**): `plan_initial` ← Z "2026 연간 추정"(= 비교 기준, **최초계획 아님**) / `jun_check_total` ← AS "2027 사업계획 합계"(= 27 계획) / `chk_m01..12` ← AT~BE
    → 계산식 검증이 그대로 성립: 차이금액(AI) = 27 계획 − 26 추정(실측 100%). 검증 기준 95%는 실적과 동일, 느슨하게 바꾸지 말 것
  - **응답** `build_plan_summary`: `total.y26`/`y27`(매출·직접원가·공통원가·매출이익·인건비·관리비·경상손익)·`total.rate`(27÷26 %)·`by_part`(`rev26/rev27/cost26/cost27`+원가 구성)·`monthly`(계획 분배). 매출이익 = 매출 − (직접원가 + 공통원가).
    y27은 프로젝트 행 합, **y26의 공통원가·인건비·관리비·경상손익은 프로젝트 행에 없어 시트 맨 아래 합계 블록(2027 시트 960~966행, 라벨은 파트 열)의 Z 열**에서 읽음 → 팀·파트 필터 중이거나 못 읽으면 None('-')
  - **합계 블록 검증이 실적과 다름**: 블록 매출·원가는 사용여부가 비거나 미사용인 행까지 합친 값이라 비교 대상을 필터 전 전체 행 합으로(`_raw_category_sum`, `df.attrs["plan_blocks"]`). 대조(2026-10-29): 사용 행 27 매출 **387.49억**·직접원가 **244.92억** vs 블록 387.59/244.96억 — 차이는 **사용여부가 빈 1건**(세아제강 AI 교육, 매출 0.097억, 코드 `생성예정`)
  - **화면**: 필터바 "보기" 칩(이름 = 실제 시트명) — 계획 시트가 있는 파일일 때만. 계획 보기의 "26 추정"은 2027 시트의 Z열 값이라 **2026 실적 보기의 추정과 다름**(교차 검증 2026-10-29: 392.2억 vs 359.91억 — 2027 시트에서 계약 통합 등으로 재정리, session-log). 2027 시트 상단(9~10행) 합계 셀은 행 합과 안 맞으니 쓰지 말 것
  - **양식이 바뀌어도 사람 손 없이 따라가기**: ① 열 맞추기 기준은 같은 뷰 안에서만 ② 기준 시트가 없으면 **`data/perf_ref_labels.json`의 마지막 정상 시트 머리글 스냅샷** 사용(직전 파일을 data/에서 치워도 유지) ③ 못 맞추거나 검증 실패 = 직전 파일 계속 표시 + 관리자 상태에 이유. 의미가 바뀐 양식(열이 아니라 구조 변경)은 사람이 코드로
- **단위**: 실적 금액은 전부 **천원**. 억 = 천원 ÷ 100,000. 엑셀 다운로드는 원(×1000). 손익률 = 원본(비율) × 100
- **행 구조**: 프로젝트당 **매출행 + 바로 아래 원가행** 2행(K열 구분). `use_yn == "사용"`·구분 매출/원가만 씀.
  표는 `_merge_rev_cost_rows`로 1행(원가행 값은 `est_cost`·`plan_cost`·`cost__필드`), 집계(summary)는 매출/원가 분리 그대로
- **함정**
  - `jun_actual`(AO/AR "N월 실적")은 원본이 **1~12월 전체**(미래월 추정 포함) → 반드시 1~기준월(chk_m01~mNN)만 재합산(`read_perf_frame`)
  - '원가'가 두 뜻: 원가행(=직접원가만, BB) vs 손익의 총원가(직접+인건비+공통+관리비). "매출 − 원가"는 경상손익이 아니라 **매출이익**
  - 실적 탭 **"당해 연도 매출이익 (계획/추정)" 카드만** 매출 − (직접원가 + 공통원가)(2026-10-23, `total.plan_gross/est_gross`) — 추정 칸 공통원가는 매출행 BD 합, **계획 칸 공통원가는 시트 맨 아래 합계 블록의 '공통원가' 줄 최초사업계획 열(9월 집계 924행 W열, 20.33억)**(`_plan_overhead_from_block`, 라벨로 찾고 같은 블록 매출·원가 줄이 프로젝트 행 합과 같을 때만 사용, 못 읽거나 팀·파트 필터 중이면 추정 공통원가로 대체 `plan_overhead_source`). **단 공통원가 카드 자체는** 대체된 값을 계획 칸에 보이면 계획=추정으로 오해되므로 `plan_overhead_source == 'estimate'`일 때 계획 칸을 '-'로 비움(2026-10-27) 프로젝트 상세의 '매출 이익' 열(매출 − 직접원가, 엑셀 BA)과 정의가 다름
  - **계획 관리비·계획 경상손익**(2026-10-27, 관리비·경상손익 카드의 계획 칸): 같은 합계 블록의 '관리비'(9월 집계 44.31억)·'손익'(9.53억) 줄 최초사업계획 열(`_plan_mgmt_profit_from_block`). 손익 = 매출 − 원가 − 공통원가 − 인건비 − 관리비(**자산 줄 제외**)가 맞을 때만 사용. 팀·파트 필터 중이거나 못 읽으면 None → 계획 칸 '-'(공통원가와 달리 추정으로 대체 안 함). **계획 인건비**도 같은 블록 '인건비' 줄(9월 집계 925행 W열, 53.61억, `plan_labor`)
  - 경상손익(BF)은 연간 기준 — 누계 손익은 행별 배부율((BC+BD+BE)÷BA)을 누계 매출이익에 적용해 재구성(`acc_operating_profit`), 적자행은 간접비 0
  - 원가행의 BA~BG는 0 — 손익은 매출행만 합산
  - 손익률 평균은 **가중평균**(Σ경상손익 ÷ Σ매출), 행별 단순평균 금지(부호까지 달라짐)
  - 진행률/달성 = 누계 매출 ÷ **연간 추정 매출**(`est_progress_rate`), 계획 대비는 `achieve_rate`(관리자 공개 범위)
  - 프로젝트코드 **빈 값**만 → 프로젝트명으로 대체(같은 이름 K뉴딜 아카데미 SW/EM 2건은 코드가 같아짐 — "_파트명" 붙이기는 해봤다가 원복, 주석으로 남김)
  - 파트 `⑦ K뉴딜TF(SW)/(EM)` → `⑦ K뉴딜TF`로 통합. 화면 파트명은 원문자(①~⑳) 뗌(`stripPartPrefix`/`PART_PREFIX_RE`)
  - 묶음 키: 정식 코드(`^[A-Za-z]\d{10,}`)는 코드만, placeholder(생성예정·드롭·미정 등)는 코드+프로젝트명, **연속 행끼리만**
- **파트별 인당 차트(2026-10-23)**: 파트 인원은 원본에 없어 관리자가 수기 입력(관리자 페이지 > 파트별 인원 섹션 → `data/headcount.json`, 키는 원문자 뗀 파트명, 0~100 · 소수 첫째 자리까지) — **현재 인원(`parts`)만 씀**(계획 인원 `plan_parts`는 2026-10-27 화면·응답 모두 주석 처리, 서버 저장값만 유지). 인당 = 파트 금액 ÷ 인원, **백엔드가 계산**(`headcount.per_head_fields`, `api_perf_summary` by_part, 천원): 인당 매출 = 연간 추정 매출(`jun_check_total`) ÷ 현재 인원 / 인당 손익 = 연간 경상손익 ÷ 현재 인원 / 인당 관리비 = 연간 관리비 ÷ 현재 인원(인당 계획 매출은 주석 처리). 인원 미입력 파트·팀 필터로 행이 잘린 다팀 파트(K뉴딜TF)는 인당 값 None → 차트에서 제외. 화면 억 표기는 둘째 자리 버림(`toEokNum2`)
- **재무 대조(완료 줄)**: 실적 당월 추정 매출(BH)·직접원가(원가행 BH) vs 재무 이력 완료 단계 매출·직접원가, 1,000원 이상 차이 → "상이".
  당월 추정 직접원가 ≥ 재무 이력 착수 직접원가(1,000원 미만 차이는 같음, 착수 0·없음은 비교 안 함) → "착수↑"

### 재무(PPT 추출) — `finance.py`, `scripts/extract_financial_ppt.py`
- `data/재무관점 필수 데이터 추출.xlsx` 시트 `취합` 16열(`EXCEL_COLS`): 코드·연도·파트·단계·매출·지출·직접원가·인건비·공통원가·경상이익·이익율·비고·파일명·처리일·반영일·미수사유. 금액 **원** 단위
- 보고단계 순서(하드코딩, 프론트 `utils/stageOrder.ts`와 같게): 검토 → 사업계획 → 사전검토 → 제안 → 착수 → 중간 → 완료 → 추가제안 → 추가중간 → 추가완료
- **완료 보고 PPT는 매출·직접원가만** 채움 — 나머지 0은 '값 없음'(화면 회색)
- 출력 xlsx를 **Excel로 열지 말 것** — AIP 레이블이 붙어 암호화되면 openpyxl이 못 읽음(Excel COM 폴백은 있으나 느림). 재무 0건이면 이것부터 의심
- 추출은 열기 실패 파일이 조용히 옛 값으로 남을 수 있음(known-issues). SoftCamp DRM(`SCDSA`) 파일은 로컬 사본으로만 열기

### KPI — `kpi.py`, `scripts/extract_kpi_ppt.py`
- 집계 대상: 정식 코드만, "추가제안" 단계 제외, **같은 (정식코드, 수행연도)는 가장 진행된 단계 1건만**(추가완료 > … > 완료 > 중간 > 착수 > 제안 …)
- 합계/평균: 항목명에 `건수`·`매출액`이 있으면 합계, 아니면 평균. 26년 목표(사업계획)는 고정값(`_PLAN_TARGETS`)
- KPI 취합 표(화면)는 전체 행 그대로, 집계에만 위 규칙. 화면의 미입력·0·하이픈은 "N"

### 공통
- 코드(.py) 바꾸면 **Flask 재시작** 필요(`python dashboard_manager.py --start`). `/api/*/reload`는 엑셀만 다시 읽음
- `data/`의 xlsx·json(학습 맵·상태·공개 범위·업데이트 메모)은 git 제외. 비밀번호·`.env`는 절대 커밋 금지
- 로그인: `utils/authMode.ts LOGIN_REQUIRED` + `app.py before_request`(지금 켜져 있음 — 끌 땐 둘 다). 계정 `.env ADMIN_ACCOUNTS`(관리자: 본인 1명만, 손대지 말 것)·`USER_ACCOUNTS`(`scripts/fill_user_accounts.py`로 채움)

## 파일 구조
```
dashboard/
├── app.py                    # Flask 앱 — 블루프린트 등록, 로그인 검사, 추출 실행, 공개 범위·데이터 이상 API
├── finance.py / kpi.py       # 재무·KPI 엑셀 읽기·집계 API
├── performance.py            # 실적현황 읽기(read_perf_frame)·캐시·집계·프로젝트 상세·열 필터·엑셀 다운로드 API
├── perf_autoupdate.py        # 새 실적 파일 열 맞추기(자동·H-chat)·계산식 검증·상태 기록
├── perf_export.py            # 프로젝트 상세 엑셀(1뎁스 + 배지) 만들기
├── paths.py                  # 데이터 경로(실적 파일 고르기 perf_excel_candidates)
├── auth.py / shared.py / downloads.py / ai_insight.py
├── scripts/                  # 추출 스크립트, check_perf_headers.py, fill_user_accounts.py
├── data/                     # 엑셀·상태 json (git 제외) — 경영실적 히스토리/ 에 지난 실적 파일
├── README.md                 # 프로젝트 설명 (한국어)
├── frontend/
│   └── src/
│       ├── store/            # filter.store, theme.store, ui.store
│       ├── hooks/viewmodels/ # KPI, Chart, Insight, ProjectTable VM
│       ├── components/ui/    # Button, KpiCard, Toggle, FilterChip ...
│       └── components/features/ # KpiSection, ChartSection ...
├── docs/
└── .claude/
    ├── settings.json
    └── skills/deploy/
```

## ⚠️ 최고 존엄 경고 — NAS 파일 절대 수정·삭제 금지
`\\10.206.32.3\기술교육팀` 하위 모든 파일은 **읽기 전용**. 수정·삭제·덮어쓰기 절대 금지.
extract 스크립트 소스로 NAS를 쓰더라도 출력은 반드시 로컬 `data/` 폴더로.
위반 시 즉시 작업 중단 후 사용자에게 경고.

## 규칙
- 커밋 메시지는 한국어로 작성
- 세션 완료 시 `docs/session-log.md` 업데이트
- AI 지시사항(CLAUDE.md, settings.json)은 GitHub에 공유
- 품질 감사 보고서(`data/quality_report.xlsx`) 생성 시 최신 템플릿(`[내부용①] 재무관점 필수 데이터` 키워드) 미반영 파일은 제외 — 담당자 요청 기준

## Git
- Remote: `https://github.com/leeks0103-hash/Finance-Dashboard.git`
- Branch: `main`
