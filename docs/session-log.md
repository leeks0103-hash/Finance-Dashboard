# 세션 진행 기록

> 2026-10-23 압축(238KB → 핵심만). 화면 픽셀·CSS 튜닝·시행착오 세부는 git 이력(`git log -p docs/session-log.md`)에서 본다.
> 여기엔 **결정·근거·함정·미해결**만 남긴다. 최신순.

---

## [2026-10-23 밤 2] 파트별 인원 카드 · 계획 인원/현재 인원 분리

- **실적 탭에 "파트별 인원" 카드**(원가분석 줄과 계획 vs 추정 매출 줄 사이, 12칸 낮은 카드): 처음엔 막대 차트 → "PM : 7명 식으로 간단하게" 요청으로 알약 목록으로. 이어서 **계획 인원/현재 인원 분리** — 위 줄 계획, 아래 줄 현재, 왼쪽 정렬, 한쪽만 입력된 파트의 빈 쪽은 '-', 맨 끝 합계 알약.
- **인원 두 가지**: `data/headcount.json`의 `parts` = 현재 인원(옛 키 그대로 — 옛 파일은 계획 전부 미입력), `plan_parts` = 계획 인원. PUT은 `plan_parts` 생략 시 저장된 계획 인원 유지. 관리자 입력 카드는 [이름 … 계획 − 값 + 명 | 현재 − 값 + 명].
- **인당 분모**: 인당 계획 매출 = 계획 매출 ÷ **계획 인원**, 인당 추정 매출·손익·관리비 = 추정값 ÷ **현재 인원**(`headcount.per_head_fields(stats, 현재, 계획)`). 계획 인원 미입력 파트는 인당 계획 막대만 빠짐(null — 차트 datalabels formatter가 null을 받아 `toFixed`로 터졌던 것 수정). 인당 차트 툴팁엔 "인원 계획 N명 · 현재 N명". 팀 필터 + K뉴딜TF는 두 인원 모두 비움.
- ⚠️ Flask 재시작 필요(`headcount.py`·`performance.py`·`app.py`). 테스트 `tests/test_headcount.py`(계획/현재 분모·옛 파일 호환·plan_parts 유지·검증).

## [2026-10-23 밤] 관리자 기능 모달 → 관리자 페이지(`#/admin`)

- **왜**: 기능이 늘어(공개 범위·로그인 요구·AI·실적 파일·파트 인원·PPT 추출·추출 현황·재무 불일치·시크릿 키 메일) 모달(375줄·1000px, 세로 나열)이 답답해짐 → 전용 페이지. **한 페이지 `#/admin`에 6개 섹션을 세로로 전부 놓고**(화면 설정·실적현황 파일·파트별 인원·PPT 추출(+추출 현황)·재무 불일치·시크릿 키 메일), 왼쪽 메뉴는 **URL을 바꾸지 않고 그 섹션으로 부드럽게 스크롤만**(`scrollIntoView`, sticky navbar 높이만큼 `scroll-margin-top`). 지금 보는 섹션 표시는 **IntersectionObserver**(화면 위 15~35% 띠에 걸친 섹션, 맨 아래 센티널이 보이면 마지막 섹션, 메뉴 클릭 직후 700ms는 옵저버 무시) — scroll 이벤트 계산 없음. 처음엔 `/admin/<섹션>` 중첩 라우트로 만들었다가 이 방식으로 교체(`/admin/…`은 `/admin`으로).
- **접근**: `AdminRoute`(App.tsx, `/*`보다 앞·TabLayout 밖) — 관리자면 페이지 / 로그인 확인 중이면 빈 화면 / **로그인 요구가 꺼져 있으면 관리자 로그인 폼**(그때 유일한 관리자 로그인 입구) / 그 외 `#/performance`로 돌려보냄. 서버 관리자 API는 그대로 403(화면 가드는 노출만). 진입: ⚙ 메뉴 "관리자 기능" → `/admin`, "추출 중…" 배지 → `/admin`+route state `{section:'extract'}`, 노란 "!" → `{section:'extract', files}`(열리자마자 그 섹션으로 스크롤, 선택 추출 미리 고름 — `AdminExtractSection`에 `key={location.key}`라 같은 페이지에서 다시 눌러도 새 파일로 시작).
- **진입·정리(추가 요청)**: ⚙ 드롭다운에서 "관리자 기능"·"차트 색상" 항목 삭제 → 오른쪽 위 ⚙ **왼쪽에 사람 아이콘 버튼**(관리자에게만 보임, 클릭 → `#/admin`). 차트 색상은 "이제 관리자 기능"이라 관리자 페이지 섹션(`AdminChartColorSection` → `ChartColorModal` 재사용, 파일을 `components/features/Admin/`로 이동)으로. ⚠️ 색은 여전히 이 브라우저(localStorage)에만 저장 — 관리자가 바꿔도 다른 사람 화면엔 적용 안 됨(서버 저장은 안 함, 필요하면 별도 과업). ⚠️ 로그인 요구를 끈 상태에선 사람 아이콘이 안 보여(비관리자) 관리자 로그인은 `#/admin` 주소로 직접 들어가야 함(AdminRoute 로그인 폼). 관리자 페이지 오른쪽 내용 폭 제한(1100px) 해제.
- **사이드바(추가 요청)**: 메뉴가 스크롤에 같이 밀려 다녀서(sticky) `position: fixed`(navbar 아래·왼쪽 끝·화면 끝까지)로 바꾸고, 아주 연한 하늘색 바탕(surface에 `rgb(0,170,210)` 9% 혼합 — 주간/야간 공통)·오른쪽 테두리로 내용 영역과 구분. 지금 보는 메뉴는 흰 칸+그림자+왼쪽 막대. **« 숨기기 / » 펼치기 버튼**(`admin-side-collapsed` localStorage 기억, 숨기면 내용이 전체 폭). 900px 이하는 사이드바가 위 가로 메뉴(고정·숨기기 없음).
- **모달로 여는 항목(추가 요청)**: 관리자 페이지에서 실적현황 파일·PPT 추출·재무 불일치("N건 보기")·시크릿 키 메일("명단 보기")은 페이지에 펼치지 않고 카드의 버튼으로 모달에서 연다(`AdminActionCard`+`Modal`; 재무 불일치·시크릿 키 메일은 패널 안 목록을 모달로). 노란 "!"의 "추출로 열기"·"추출 중…" 배지는 **관리자 페이지로 안 넘어가고 PPT 추출 모달(`AdminExtractModal`)을 바로 연다**(route state 방식 폐기). 파트별 인원은 UI 개편(카드마다 [이름 … − 값 + 명], 합계·입력 파트 수) + **상단 바 사람들 아이콘(관리자만)으로 인원 모달 바로 열기**(`PartHeadcountModal`, 같은 패널 재사용).
- ⚠️ **수정 중 개발 서버 오류**: 파일을 여러 번 나눠 저장하면 Vite HMR이 중간(깨진) 상태를 읽어 `… is not defined` 같은 오류가 남 — 한꺼번에 저장하고 `touch`. 로컬에서 실제 화면은 Playwright(msedge)로 개발 서버를 열어 `/api/**`만 가짜 응답으로 가로채 확인(주의: 라우트 패턴을 `**/api/**`로 쓰면 Vite의 `/src/api/*.ts` 모듈까지 가로챔, 첫 방문 투어가 `/performance`로 보내므로 `ui-store`에 `tourSeen` 지정).
- **코드**: 패널 8개를 `layouts/Navbar/` → `components/features/Admin/`로 `git mv`(이력 보존), `AdminModal.tsx` 삭제 → `AdminSettingsSection`·`AdminExtractSection`·`AdminLogin`·`AdminRoute` + 뷰모델 `useAdminSettingsViewModel`·`useAdminExtractViewModel`(핸들러·확인창·`EXTRACT_MODE_INFO`·`VISIBILITY_ITEMS`), `pages/Admin/AdminPage`. `AdminRoute.test.tsx` 5개·`AdminPage.test.tsx` 5개(스크롤·옵저버·state.section).
- ⚠️ **`npx tsc --noEmit -p .`는 루트 tsconfig가 `files: []`+references라 아무것도 검사하지 않음** — 타입 검사는 `npx tsc -b`(= `npm run build`)로. 이번에 `tsc -b`로 처음 돌려 기존·내 오류 4건(확대 버튼 주석 처리 후 미사용 prop, 월별 차트 datalabels font 타입, `rates` 사용자 필드 타입 2곳)을 고침.
- **매출이익 카드 정렬**: 제목 아래 계산식 줄(`labelNote`)이 붙는 이 카드 때문에 폭이 보통일 때 수치가 밀리던 것 → 제목 전용 클래스 `.labelNoted` + 모든 비교 카드 머리글 `min-height: 2.6em`(두 줄 분량) 고정.

---

## [2026-10-23 저녁] 파트별 인당 차트 · 파트 인원 수기 입력 · 확대 버튼 주석

- **인당 매출/손익/관리비 차트**(계획 vs 추정 실적 아래 새 줄, 4칸×3): 인당 매출만 계획 vs 추정 2막대, 손익·관리비는 계획값이 원본에 없어 추정 1막대. 화면 억 둘째 자리 버림. 인원 미입력 파트는 제외(제목 옆 "N개 파트 제외", 하나도 없으면 안내 문구 — 관리자에게만 입력 위치 안내). 저장 키 `performance-chart-order-v4`(옛 순서 초기화).
- **파트 인원**: 관리자 기능 > 파트별 인원(`PartHeadcountPanel`) → `PUT /api/settings/headcount` → 인원은 **정수**(명) `data/headcount.json`(git 제외, 서버 PC 한 곳). 저장하면 `['perf-summary']`를 다시 불러 차트 즉시 갱신. 읽기는 로그인한 누구나. 계산·검증은 `headcount.py`(테스트 `tests/test_headcount.py` 20개). ⚠️ Flask 재시작 필요. **팀 필터 + K뉴딜TF(세 팀에 걸침)는 인당 값 비움**(파트 전체 인원 ÷ 팀 몫 금액이 되어 틀림).
- **시크릿 키 메일 문구 교체**(`secret_mail.SUBJECT`·`BODY_TEMPLATE`): 제목 "경영현황 통합 대시보드 접속 안내", 보직자 이상 공유 안내 + URL·ID(사번)·PW(시크릿 키 변수 `{key}`). 내선 문의 줄과 "7일간 유지" 안내는 뺌 — ⚠️ 토큰엔 만료가 없음(`auth.py` 서명만, localStorage 유지; 비밀번호를 바꿔야 끊김). **발송은 안 함.**
- **차트 배치 확정(10-23 요청)**: 1줄 진도율+파트별 매출 실적 진행 현황, 2줄 원가분석+전체 평균 원가 비율, **3줄 파트별 계획 vs 추정 실적·인당 매출·인당 손익·인당 관리비(3칸×4)**. 한 줄 4개는 노트북 폭에서 빡빡할 수 있어(계획 vs 추정 실적 막대 끝 `(104.1%)`) 보고 불편하면 되돌릴 것(예전: 3줄 인당 3개 4칸×3 / 4줄 계획 vs 추정 실적 12칸). **줄 구성 고정** — 같은 줄 안에서 좌우 순서만 드래그로 바꿈(`isValidChartOrder`가 `DEFAULT_CHART_ROWS` 구성 검사, 줄 바꾸기 더블클릭 삭제). 드롭 판정은 같은 줄 카드만 후보 + 커서가 올라간 카드 우선(`rowCollision`) — closestCenter는 3칸 좁은 카드 줄에서 순서가 안 바뀌었음. 저장 키 `performance-chart-order-v7`.
- 인당 차트 3개는 계획 vs 추정 실적과 같은 방식(`fitBarLabelsPlugin`, 오른쪽 여백 8px)으로 막대 폭 확보. 매출이익 카드 제목 아래 회색 계산식(`labelNote`, `PerfCompareCard.test.tsx`). "파트별 매출 진행 현황" → "파트별 매출 **실적** 진행 현황".
- **확대(⤢) 버튼 전부 주석 처리**(요청): ChartCard·CostBreakdownModal·FinMismatch·투어 문구·ChartCard 확대 테스트(skip). 복구 방법은 각 주석에.

---

## [2026-10-23 오후] 범례 제목줄 이동 · 진도율 누계 실적 · 계획 공통원가

- **파트별 매출 진행 현황 범례**를 막대 위가 아니라 ChartCard 제목줄(`titleCompact`)의 자식으로 — `ChartCard`에 `titleAside` prop, `PartAchievementLegend` 분리. `.titleCompact`의 `padding-right: 28px` 제거(확대 버튼 자리 — 확대 가능한 카드에서 겹치면 다시 볼 것).
- **진도율(월별 실적 추이)**: 막대 위 수치 14→13px·원가율 12→11px + 자간 -0.4px(`tightLabelsPlugin`, 캔버스 letterSpacing). 제목 옆에 "매출/원가 추정 누계 실적 (1~N월)" + 진행률(`monthly.cumulative`, 매출=파랑·원가=갈색 막대색, 제목·안내 사이 가운데). 예전 KPI 카드 `junActual`은 주석 그대로.
- **계획 공통원가**: 시트 합계 블록(9월 집계 922~928행: 매출·원가·공통원가·인건비·자산·관리비·손익)의 '공통원가' 줄 최초사업계획 열(W) = 2,033,364천원. 계획 매출이익 = 321.29 − (193.51 + 20.33) = **107.45억**(예전 추정 공통원가 18.96 대체값 108.83). 행 번호는 시트마다 달라(9월 추정은 918행) 구분 열 라벨로 찾음. 빨간 "계획" 표시(`planWarn`)는 제거. ⚠️ Flask 재시작 필요(code 변경). 팀·파트 필터 중엔 블록이 전사 값이라 추정 공통원가로 대체(`plan_overhead_source: estimate`).

---

## [2026-10-22 ~ 23] 로그인 토글 · 업데이트 요청 · 시크릿 키 메일 · 실적 카드/차트 개편

- **로그인 요구를 관리자 기능 토글로**: `data/access.json`(없거나 깨지면 **켜짐**), `GET /api/settings/access`(로그인 전 공개)·`PUT`(관리자). `auth.login_required()`(mtime 캐시)를 `login_required_for_api`가 봄 — 꺼져도 `@admin_required` API는 403. 프론트 `useLoginRequired`(30초·창 복귀 시 재조회, 서버 못 닿으면 '요구'), `authMode.ts` 상수 삭제. 켜지면 새로고침 없이 로그인 화면으로.
- **업데이트(재추출) 요청 부활**: 헤더 노란 "!"·`useOpenFile.requestUpdate`·`request_bp` 복구. 공개 범위 `extractRequest` **기본 숨김**. (10-22 낮에 잠깐 주석 처리했던 것.)
- **시크릿 키 메일**: 제목/본문 템플릿(`secret_mail.BODY_TEMPLATE`, `{url}{emp}{key}`), 접속 주소 `DASHBOARD_URL` 10.206.33.120:5188, 문의 내선 8020. **발송은 안 함.**
- **AI 인사이트 "분석 실패" 수정**: 분석 1회 92~97초인데 화면 대기 `AI_TIMEOUT_MS`가 90초 → 200초(서버 H-Chat 한도 150초보다 크게). 같은 분석 겹침은 항목별 잠금(`_analysis_locks`)으로 차단.
- **정리**: 안 쓰는 CSS 클래스 53개·`scripts/debug_*.py` 4개 삭제, `api-spec.md`·`data-schema.md` 현행화(55개 API·16열), `.gitignore`를 `data/**/*.json` 패턴으로(pull이 각자 PC 설정 파일을 덮어쓰지 않게). 남긴 것: 일회성 보고서 스크립트 8개(`quality_audit*` — 품질 감사 규칙 관련).
- **실적 카드/차트 개편(10-23 요청)**
  - "당해 연도 원가" → "**직접 원가**" 제목. **매출이익 카드 정의 변경: 매출 − (직접원가 + 공통원가)**(`total.plan_gross/est_gross`). 공통원가는 매출행 BD(연간 추정)뿐이라 **계획 칸에도 추정 공통원가를 차감** → 계획 글자를 빨간색(`planWarn`)으로 표시해 둠. ⚠️ **계획 공통원가 데이터가 생기면 값을 고치고 이 빨간 표시를 뺄 것.** 이 카드만 — 프로젝트 상세 '매출 이익' 열(BA)·BA=BH−BB 검증식·드릴다운 용어는 그대로. 대조(9월 집계): 추정 359.97−(226.65+18.96)=114.36억, 계획 321.29−(193.51+18.96)=108.83억, 엑셀 경상손익(BF) 합 16.58억 = 114.36−인건비 55.98−관리비 41.80(차이 0).
  - "당해 연도 추정 관리비" 카드 추가(`total.cost_mgmt`, 보조줄 `est_mgmt_rate`=관리비÷추정 매출 11.6%). "매출/원가 추정 누계 실적" 카드는 **주석 처리**(수치는 진도율 차트 옆에 보여줄 예정 — `junActual`·`DEFAULT_KPI_ORDER`). 저장된 카드 순서는 새 카드를 기본 순서상 앞 카드 뒤에 끼워 넣음.
  - 차트 제목: "월별 실적 추이" → "진도율(월별 실적 추이)", "파트별 추정 매출/원가" → "원가분석(파트별 추정 매출/원가)". (코드 주석·ⓘ 본문은 예전 이름 그대로)
  - **차트 배치**: 1줄 = 진도율(8칸) + 파트별 매출 진행 현황(4칸), 2줄 = 원가분석(8) + 원가 비율 도넛(4), 3줄 = 파트별 계획 vs 추정 실적(12칸, 위치 미정). 파트별 매출 진행 현황은 별도 섹션 → `PerformanceChartSection`의 `achievement` prop 한 칸(드래그 대상 포함, 투어 앵커 `perf-achievement`). 저장 키 `performance-chart-order-v3`.
  - 확인창(`utils/dialog`) 폭 `min(580px,92vw)`, `**굵게**` 지원. 툴팁 문구 정리(파일/폴더 바로가기·업데이트 요청·내용 복사).
- ⚠️ 위 변경 후 Flask 재시작함. 현재 작업 트리: `PartAchievementBars`·`PerformanceChartSection`·`PerformancePage` 수정(차트 배치) 커밋 전.

## [2026-10-15 ~ 21] 실적 자동 반영 · 계정 · 숫자 배지 · 팀 선택 K뉴딜

- **실적 새 파일 자동 반영 켬**(2026-10-15): `PERF_AUTO_UPDATE`·`PERF_PICK_NEWEST` True + AdminModal `PerfUpdatePanel`. 흐름·검증식은 CLAUDE.md "데이터 규칙"이 기준. 업로드: 내용까지 같으면 안내, 이름만 같고 다르면 기존 파일을 `경영실적 히스토리/<이름>_교체전_<시각>.xlsx`로 옮기고 교체. `.env PERF_EXCEL_PATH`는 data/에 후보 없을 때만.
- **임직원 계정**: 명단(사번·시크릿키 68명) → `.env USER_ACCOUNTS`에 사번:비밀번호만(`scripts/fill_user_accounts.py`, 기본 미리보기·`--apply`), 관리자 사번은 일반 회원에서 제외(67명). ⚠️ 명단 엑셀(`현대엔지비사용자목록_261014.xlsx`)이 GitHub 이력에 남아 있음 — 이력 정리(force push)·비밀번호 교체 여부 **결정 필요**.
- **숫자 배지**: `E148…_SW`처럼 붙여 만든 코드는 배지 없음(`REAL_CODE_RE`: 코드 바로 뒤가 끝·공백·괄호일 때만 정식). `projectCode.test.ts` 6개.
- **git pull 실패 원인**: `.gitignore`가 `data/*.xlsx`라 하위 폴더 엑셀이 커밋돼 있어 상대 PC에서 "untracked files would be overwritten" → `data/**/…`로 변경·추적 해제.
- **팀 선택 시 K뉴딜TF**: 원본에서 K뉴딜TF 행이 세 팀에 2행씩 나뉘어 있음. 10-20엔 팀 선택 시 제외(`_TEAMLESS_PARTS`)했다가 10-21에 **행의 팀 칸으로 거르는 방식**으로 교체(자기 팀 몫 포함). 도넛 팀 보기는 서버 `by_team`. 코드 빈 행·placeholder 묶음 키에 팀 추가. 대조: 팀 합 = 전체 359.97억, 팀별 경상손익 7.61+5.23+3.73=16.6억.
- **PPT 추출 "선택" 방식**(10-20): 원본 폴더 파일 목록에서 고른 파일만 재추출(mode `selected`+`files` ≤300, `EXTRACT_ONLY_LIST`, `EXTRACT_REPLACE_FILE_ROWS=1`로 성공한 파일의 기존 행을 지우고 새로 넣음 — PPT에서 지운 행·바뀐 코드의 옛 행 반영). 열기 실패면 안 지움. 데이터 이상 걸린 파일은 목록 맨 위·빨간 행. 추출 "전체"(force) 방식은 비활성(증분·선택·초기화만). **실제 선택 추출은 아직 안 돌려봄.**
- **KPI 보고단계 버그**: 재무 표 '구분'이 "중간 (상반기)"처럼 괄호 설명이 붙으면 단계로 인정 안 해 '착수'가 골라져 `_중간.pptx` KPI가 착수로 기록 → `_pick_latest_stage`가 괄호 앞만 봄. **재추출 전.**
- **데이터 이상 "수정 완료"**: "!" 목록 파일마다 버튼(누구나), `data/health_ack.json` 저장, 다시 추출되면(처리일시 > 표시 시각) 자동 해제. 코드충돌은 재무·KPI 한 줄로, 지금 원본 폴더에 없는 파일은 제외(남은 파일 2개 미만이면 충돌 아님). '생성 예정'류 코드 충돌은 관리자에게만(`pending`). 메일 알림은 안 함.
- 공개 범위: `folderOpen`(폴더 바로가기) 분리, `achieveRate`에 all 추가(저조 팀 노출 방지는 관리자 판단으로 열어 둠), `aiInsight` 토글(기본 끔).
- **차트**: 파트별 추정 매출/원가를 2층(직접원가 원가행 BH + 공통원가 매출행 BD)으로. 공통원가 층이 너무 얇아 **층 경계만 최소 높이로 보정**(막대 전체 높이=실제 합계는 그대로, 툴팁·숫자는 실제값 `realData`). 원가율 = 원가(직접+공통) ÷ 매출, 제목 안내. 파트별 계획 vs 추정 실적에 달성률 %(공개 범위 따름 → 10-21에 "항상 표시"로 변경). 월별 추이도 원가율 표시. 원가 도넛 라벨 겹침(`outsideLabelsPlugin`)·좌우 잘림 수정. 드래그는 DragOverlay(미니 카드), 핸들 더블클릭 = 줄 통째 맞바꿈(`swapChartRow`).
- 월별 "원가 빼고 계획·추정 매출" — 원본에 월별 계획이 없어(연간 최초계획 한 칸) **보류**.
- 공개 범위 버튼 깜빡임 → 낙관적 반영. README 604줄 → 지금 쓰는 것만. 경상손익 색 역할 `costProfit` 신설, 차트 색상 주간/야간 따로(`{light, dark}`).
- 드릴다운 모달 프로젝트명 한 줄(`WIDE_MODAL_W`). 프로젝트 상세 비교 칸 호버 시 재무 이력 짝 열 하이라이트(`linkedExpandCol`), 재무 대조(F) 테두리 색: 매출=Active Blue, 직접원가=Hyundai Gold.
- 로그인: 10-19 회의용으로 잠깐 껐다가 10-22 저녁 다시 켬(`LOGIN_REQUIRED`+`before_request`).

## [2026-10-14] 실적 ver9.4(9월 집계) 대응 · 자동 반영 개발 · 프로젝트 상세 필터/엑셀

- **ver9.4**: R열 "DK수정 (향후삭제)" 삽입 → 17 이상 +1(`_PERF_COL_MAP_SEP`). 원본에서 그 컬럼이 지워지면 `_PERF_COL_MAP_AUG`로 복귀. 검증식 전부 100%.
- **자동 반영 설계**(CLAUDE.md 참고): 기준 시트와 머리글 대조(월·연도 숫자 제외)로 열 옮김 → 못 찾은 필수 열만 H-chat 제안(머리글 글자만 전송) → 계산식 검증 95%↑ → 통과 시 맵 학습(`data/perf_col_maps.json`), 실패 시 직전 파일 유지 + `perf_update_status.json`. 시험: 9월 맵 삭제 후 자동 매핑이 수작업 맵과 완전 일치, 깨진 파일은 검증에서 차단, 틀린 맵은 일치율 30%대로 확인. `read_perf_frame(path, sheet, col_map)`로 캐시와 검증이 같은 규칙 사용.
- **프로젝트 상세**: 머리글 열 필터(깔때기: 글자/고르기/숫자, `cf` JSON, `apply_column_filters`, 억→천원 변환은 서버), 엑셀 다운로드(`perf_export.py`, 1뎁스+배지·메모·"확인 사항" 열, Raw Data 메뉴 "프로젝트 상세"는 받을 때 생성), 재무 대조 배지(빨간 "상이" / 파란 "착수↑": 완료 줄 직접원가 ≥ 재무 착수 직접원가, 1,000원 미만 차이는 같음, 착수 0·없음은 비교 안 함).
- 빈 프로젝트코드: "프로젝트명_파트명"을 해봤다가 **프로젝트명만으로 원복**(파트 붙이기는 주석). 실적 필터바 "경영실적 현황 업데이트" 칸(라벨·날짜 모두 관리자 입력, `data/perf_update.json`, 일반 회원은 글자만).
- 로그인 화면(tsParticles 배경)은 10-13 도입 — 일반 회원/관리자 분리(`USER_ACCOUNTS`/`ADMIN_ACCOUNTS`, 같은 사번이면 관리자).

## [2026-10-12 ~ 13] 관리자 전용 섹션 원복 · 글꼴 · 로그인

- 10-06에 관리자 전용으로 돌렸던 미수주·프로젝트 상세·KPI 취합을 **다시 모두에게**. "조직장 이상" 버튼 삭제. 관리자 로그인은 ⚙ > 관리자 기능에서만. 관리자 기능(추출·추출 현황·재무 불일치·공개 범위)은 그대로 403 보호. 미수주 표 key 중복 경고는 `/api/finance/missed-bid`에 `_row_num` 추가로 해결.
- **글꼴**: @font-face `font-display: optional` + Vite dev 서버 no-cache + 한글 TTF 3MB → 잠금·절전 후 Vite 재연결 새로고침 시 대체 글꼴로 굳음. preload 추가 후 글꼴 자체를 **Pretendard(npm, 자체 제공 woff2)** 로 교체(CDN은 사내망에서 막혀 있었음). ⚠️ python으로 고친 파일을 Vite가 못 알아채면 `touch`.
- 서버 전체 API 잠금: `auth.PUBLIC_API`(로그인·me·access·reload 3개) 외 `/api/*`는 로그인 필요. 다운로드 링크는 `?token=`.
- 차트 색상 모달: 저장 버튼·확인창·주간/야간·직접 고르기(react-colorful)·충돌/대비 경고(푸터 한 줄). 저장 안 하면 미리보기만.

## [2026-10-06 ~ 08] 공개 범위 서버 저장 · 관리자 로그인 · 차트 색상 · 정렬

- **공개 범위**를 localStorage → `data/visibility.json` 서버 저장(모든 화면 적용). 기본 fileOpen=admin·achieveRate=none. 노출만 관리(API는 안 막음).
- **관리자 로그인**: 공용 키 → 사번·비밀번호(`ADMIN_ACCOUNTS`), 토큰 `사번.HMAC`(서명 키는 `ADMIN_TOKEN_SECRET`/`EXTRACT_ADMIN_KEY`, 둘 다 없으면 `ADMIN_ACCOUNTS`에서 생성), 헤더 `X-Extract-Key`.
- 서버 정렬(`shared.sort_frame`, 페이지 자르기 전 전체 기준)·정렬 상태 localStorage 유지(`useServerSort(resetPage, storageKey)`).
- 폴더 바로가기(`explorer /select,`), 서버가 띄운 창 앞으로(`_bring_new_window_to_front`).
- 완료 프로젝트 재무 불일치 관리자 목록(`/api/performance/fin-mismatch`), 표 컬럼 끌어 옮기기 버그(`mergeColumnOrder`), 데이터 이상 '확인' 묶음(`likely_same_project`) 제거.
- **NAS 접근 불가**(10-08): 네트워크는 정상, Windows가 자격 증명 거부 → 탐색기에서 `\\10.206.32.3\기술교육팀` 다시 로그인 필요(코드 문제 아님).
- 차트 색상 사용자 지정(역할별 견본·직접 고르기, `chartColors`, `ui.store.chartColors`): 견본 밖 색·흰 배경 대비·같은 차트 역할끼리 비슷하면 경고.

## [2026-10-01 ~ 02] 실적 기준월 · DRM · AI 숨김 · KPI "N"

- **실적 기준월은 달력이 아니라 읽은 시트 기준**: 프론트가 "오늘−1개월"로 짐작해 10-01에 없는 9월이 실적으로 칠해진 사고 → `/api/performance/summary`의 `base:{year,month}`, `usePerfPeriod`. (Flask 재시작 전엔 달력 폴백이 보임)
- **DRM(SCDSA) 파일 열기 차단**(`shared.open_source_file`, 403). 실패 파일 재추출은 DRM도 시도하되 **로컬 사본으로만**(`local_if_drm`). 재추출 후 화면이 안 바뀌던 것: `useExtractJob`이 완료 시각(`finished_at`) 변경을 봐야 캐시 무효화 + 비관리자 30초 폴링.
- `dashboard_start.bat`/`update.bat`을 자기 폴더(`%~dp0`) 기준으로(다른 PC에서 재시작 안 되던 것). `update.bat`은 엑셀 reload만(코드 변경 미반영).
- 추출 현황(`extract_coverage.py`, 관리자): 원본 폴더 파일 수 vs 추출됨/다른 보고서로 반영/표 없음/열기 실패/아직 안 읽음. 실패 문구는 쉬운 말 한 줄 + 원본 메시지는 툴팁.
- **AI 인사이트 버튼 숨김**(요청 → 이후 관리자 토글 `aiInsight`로 대체). KPI 취합 미입력·0·하이픈은 "N"로 통일(`cellVal`).
- 프로젝트 상세: 매출/원가 2행 → **프로젝트당 1행**(`_merge_rev_cost_rows`, 원가행 값은 `cost__필드`), 당월 추정 직접원가(원가행 BH)·매출 이익(매출행 BH−원가행 BH)을 사용자 정의 열로, 숨김 컬럼 대거 주석 처리, 재무 대조(완료 줄 매출·직접원가 1,000원 이상 차이 → 빨강). `/api/performance/data` NaN → null(JSON 깨져 0건으로 보이던 것).
- **파트별 매출 진행 현황 분모**: 계획매출 → **연간 추정매출**(`est_progress_rate`). 누계 카드에 진행률 병기. 금액 표기는 억 소수 둘째 자리 **버림**(`Math.trunc`).
- 설정 토글 단축키 G(그래프 수치)·W(표 금액 원 단위)·F(재무 대조).
- **⚠️ 증분 추출 "수정했는데 안 바뀜" 원인 3가지**: ① 열기 실패 파일은 옛 값이 남는데 화면엔 "완료"(스크립트가 실패해도 exit 0) — 모비우스 완료 파일이 09-23부터 계속 실패 ② 비고·미수사유는 "새 값이 비면 기존 유지"라 PPT에서 지워도 증분으론 안 지워짐(초기화·선택 방식으로) ③ 같은 키 행을 여러 단계 PPT가 들고 있으면 증분은 방금 고친 파일 값, 전체·초기화는 가장 오래된 파일 값이 남음.
- **NAS 원본 6개가 SoftCamp DRM(`SCDSA`)으로 암호화** — 수정 시각이 09-23 추출이 연 시각과 1~2초 차이. 이 PC의 PowerPoint 열기가 DRM 재암호화를 유발한 것으로 추정. 스크립트는 NAS에 안 씀. 원본 담당자 확인 필요(`known-issues.md`).

## [2026-09-28 ~ 30] 2뎁스 · 투어 · 모달/코드 정리

- **드릴다운 모달**(`BreakdownModal` 공용 조각), 모달 뼈대 공용화(`components/ui/Modal`), 백엔드 중복 → `shared.py`(`safe_mtime`·`find_source_path`·`open_source_file`·`strip_part_prefix`), 전후 API 19개 동일 검증.
- **프로젝트 상세 검색 → 재무 이력 자동 펼침**(별도 "재무 데이터 검색 결과" 표 제거). 2뎁스 슬라이드 펼침·접힘, 다른 행 더블클릭 시 순서대로(접기 → 펼치기, `keepRowInPlace`). 검색 결과 1건 시 화면 튐(전환 정리 함수·스크롤 클램프) 수정.
- **사용법 투어**(driver.js, `ProductTour/tourSteps.ts`): 첫 방문 자동 1회(`tourSeen`, 브라우저 기준 — 배포 후 서버 저장으로 이전 과제), 어두운 여백 클릭으로 안 닫힘. ⚠️ 섹션 추가/삭제 시 `tourSteps.ts`도 맞출 것. 투어 'actions' 단계 AI 인사이트 문구는 아직 주석 그대로.
- 재무 이력 2뎁스를 검색 결과와 같은 `DataTable`로 통일(`financeColumns.tsx` 공용). 재무 이력 금액 툴팁 쉼표(`wonTitle`).
- **KPI 추출 보고단계**: 파일명 → **PPT 재무 표 '구분'** 기준(`pick_stage_from_pptx/com`, 재무 표 없으면 파일명). `kpi.py` `_STAGE_PRIORITY`에 추가제안/추가중간/추가완료 추가 → 추가개발 KPI 행 복구. 재무 행 순서는 보고단계 하드코딩 순(`_order_by_stage`).
- 코드충돌 허용 조건: 한쪽이 '추가' 단계 파일이면 충돌에서 제외. `paths.PPT_SOURCE_DIR`로 PPT 원본 폴더 **NAS 고정**(.env·CLI 인수 무시), 출력은 로컬 `data/`.
- 달성률은 관리자 토글, 저조 팀·프로젝트 낙인 표시(행 막대·상시 달성률) 안 넣음(원칙).
- 도넛 인출선·확대 모달 보강, 파트별 계획 vs 추정 실적 표(체크로 파트 제외), 캔버스 글씨 흐림(`chartCrisp.ts`), 차트 글자 +1px.

## [2026-09-16 ~ 17] NAS 추출 경로 · 옛 행 정리 · KPI↔재무 코드 불일치 0건

- `dashboard_update.py/.bat`이 CLI 인수로 로컬 Desktop 경로를 넘겨 `.env`(NAS)를 덮어쓰던 버그 → 인수 제거. (스크립트는 **CLI 인수가 있으면 .env를 완전히 덮어씀**)
- 재무 추출에 `cleanup_stale_rows()` 포팅(KPI는 09-08에 있었음): PPT에서 코드를 정정해도 옛 코드 행이 쌓이던 것 방지. 열기 실패/표 없음 파일은 안 건드림.
- KPI 코드 불일치 6 → 0: 대부분 KPI 표에 템플릿 복사로 남은 오입력 코드(`E126600125030001`이 4개 프로젝트에 남음). "재추출해도 그대로"는 로직 버그가 아니라 PPT 저장이 마지막 재추출보다 나중이었던 순서 문제.
- 코드충돌 시트 AIP 암호화 우회(COM 재시도) + 읽기 실패 배지. 대시보드 공유 주소 `http://10.206.32.222:5188`(LAN, `strictPort`).

## [2026-09-14] 실적 ver8.4 · K뉴딜TF 통합

- "8월 집계" 시트 추가 → 8월 추정과 구조 동일해 맵 재사용. 컬럼맵 갱신은 **새 시트마다 `check_perf_headers.py`로 사람이 대조**(당시 방침 — 이후 10-15에 자동화).
- 파트 `⑦ K뉴딜TF(SW)/(EM)` → `⑦ K뉴딜TF` 통합(`load_perf_excel` 정규식 한 줄).
- `dashboard_manager.py`: netstat 디코드(cp949) 크래시 → bytes+`errors="replace"`. (이전 09-07 재작성: 포트 실제 응답 기준, 트리째 종료.)

## [2026-09-08 ~ 11] 파생값 백엔드 이전 · 드릴다운 · 검증

- **계산은 백엔드, 프론트는 표시만**: `by_part.profit_rate/expense_ratio`, `plan_gross/est_gross`, `achieve_rate`, `mom_*`, `cost_rate`, `kpi plan_target` 등 이전. `QueryGate`(로딩·에러·빈 상태 구분), `FilterSelect`·`FadeInSection` 공용화.
- **막대 클릭 → 산출 근거 드릴다운**(KPI·실적 차트 전부, 도넛·파트 달성 현황 포함): `/api/kpi/summary/breakdown`, `/api/performance/summary/breakdown`. 백엔드 `_PERF_BREAKDOWN`에 없는 차트·시리즈는 `canPerfBreakdown`이 막음(시리즈 추가 시 `PERF_BREAKDOWN_SERIES`도). 계획 vs 실적 pair 차트는 계획·실적·달성률 비교표.
- **KPI dedup 코드 충돌 버그(중요)**: `프로젝트코드="미정"` 등을 서로 다른 프로젝트가 공유 → (코드, 연도)만으로 묶어 값 있는 행이 삭제됨. dedup 키를 `(코드, 연도, 파일명 기준명)`으로(`strip_stage_suffix` 공용화) — 108 → 128건, 신사업 매출액 목표 129.3 → 142.0억. 알려진 한계: 완료/제안 파일명이 `26년_` vs `26년 `처럼 언더바 유무만 다르면 기준명이 갈라짐(현재 영향 없음).
- KPI 집계 규칙 확정: 프로젝트당 가장 진행된 단계 1건(완료>중간>착수>제안), 목표도 취합에서 직접 집계(시트 값은 단계 중복), **매출액·금액 지표는 합계**(`_SUM_KEYWORDS`; 엑셀 `kpi 집계` 시트는 여전히 전체 행 기준이라 값이 다를 수 있음). 26년 목표(사업계획) 컬럼은 고정값(`_PLAN_TARGETS`). 필터 store `syncOptions`(새 옵션값 자동 추가).
- 원본 분석 보고서(`scripts/make_analysis_report.py` → `data/실적데이터_분석보고서.xlsx`, git 제외): 계산식 16개 592행 전수 검증(BA=BH−BB, BF=BA−BC−BD−BE, BG=BF÷BH, BH=1~12월 합, AX=BH−V …). **AR열은 이름과 달리 연간 전체(=BH)** → `jun_actual` 1~기준월 재합산이 필요함을 입증. 파트별 대시보드 값 = 독립 재계산 값.
  - 이월 과제: **'달성률' 표기**(누계÷연간계획이라 44%로 미달처럼 보임 — 진도율 개명/기준선/안분 계획 중 택1), 원본 AR열 이름 정정 요청, KPI 카드 '원가'=직접원가만임을 화면에도 드러낼지.
- 프로젝트 병합 키: 정식 코드(`^[A-Za-z]\d{10,}`)는 코드만, placeholder는 코드+이름, 연속 행끼리만(`_group_no`와 프론트 키 규칙을 맞출 것). 원본 `H093600126020002` 프로젝트명 오타 정리 필요.
- 도넛에 관리비 추가(관리비가 원가의 12%), 제목 "프로젝트 합계 원가비율". 파트 정렬 `utils/partOrder.ts`, 달성률 70% 미만 Hyundai Gold.
- 루트 정리: PNG 170개·`playgrounds/`·`diagnostic.py`·옛 Flask 페이지(`templates/`·`static/`) 삭제.
- 미해결/기존 실패: `test_finance_api.py`/`test_finance_load.py` 14건(`EXCEL_COLS` 16열 vs `conftest` 15열 — 이번 변경과 무관), 재무 비고 검색 안 됨(여러 세션 이월), scheduler 데몬 `다음 실행` 시각 정상화 확인.

## [2026-09-02 ~ 07] 디자인 시스템 · 현대 브랜드 9색

- AdminLTE/Bootstrap5 톤 실측값(라이브러리 설치 없이 토큰만)으로 전환 후, 9-07에 **현대 공식 9색 + 파생 톤만** 사용하도록 전면 교체(이익=Active Red, 손실=Hyundai Blue, 다크는 Hyundai Blue 파생). `--accent` 미정의 버그 14곳 복구, 라이트 배경 화이트·테이블 Light Sand.
- 차트: datalabel 잘림(`makeBarOptions` 최소 여백), 정렬 화살표(심볼 폰트), 페이지네이션 블록 방식(1~10), 폰트 `HyundaiSans` 통일(이후 Pretendard).
- 탭: 경영실적/재무데이터 · KPI/경영현황 · 강사만족도(플레이스홀더, 현재 `TabNav`에서 주석 처리).
- **재무 데이터 0건 사고(09-07)**: 출력 xlsx가 AIP 암호화 + 재추출이 파일 중간 크래시(최종 `wb.save()` 미실행) → 빈 캐시. 좀비 `POWERPNT.EXE`/`EXCEL` 정리 후 재추출 + `/api/reload`. **출력 xlsx를 Excel로 열지 말 것.**
- 아키텍처 규칙 위반 정리(raw `<button>`, ViewModel 분리, 순수 함수 `utils/`), `paths.py` 신설(데이터 경로 단일 관리).

## [2026-08-03 ~ 09-01] 초기 구축 이후

- 3탭 대시보드(재무·KPI·실적), React Router(HashRouter), `DataTable`(TanStack — 컬럼 DnD·리사이즈·auto-fit·서버 페이지/정렬/필터), `KpiRawTable`(KPI 상세 rowspan 뷰), 실적 인사이트(`/api/performance/insights`), 재무 미수사유 추출(16열), `[신규/미생성]` 정규식 placeholder, 필터 칩 UI·"전체" 칩, 검색 정규식 버그(`regex=False`), KPI `_적절성` 10 초과 의심 행 표시, `vite.config.ts` `BACKEND_PORT` 환경변수.
- 추출 스크립트: 증분 업데이트(`RESET_OUTPUT_ON_START=False`), 폴더명 기반 파트(`FOLDER_PART_MAP`), CLI 인수 지원, 매뉴얼맵 HTML 자동화(`scripts/make_manual_map.py`, 스케줄러 월~금 08:00·14:00).
- React가 `rowSpan={1}`도 `rowspan="1"`로 렌더 → `td:not([rowspan])` 선택자 무효(`td:not(.spanCell)`로 교체).

## [2026-07-20 ~ 30] 초기

- Flask 앱 + 엑셀 로드·필터·집계·인사이트 API, GitHub push, CLAUDE.md·`docs/`·훅·`/deploy` 스킬, pandas 도입(`profit_rate` 이중 파싱 해소), PDF 내보내기(`/api/export/pdf`, 맑은고딕), 3탭 구조(재무·KPI·실적).
