# 세션 진행 기록

> 2026-10-23 압축(238KB → 핵심만). 화면 픽셀·CSS 튜닝·시행착오 세부는 git 이력(`git log -p docs/session-log.md`)에서 본다.
> 여기엔 **결정·근거·함정·미해결**만 남긴다. 최신순.

---

## [2026-10-29 저녁] 파트별 인원 2026 / 2027 분리 · 계획 보기 첫 두 차트 한 줄

- **왜**: 2027 계획 보기의 인당 3종이 2026 "현재 인원"(`parts`)을 빌려 쓰고 있어, 2027 인원을 따로 정할 수도 없고 2026 인원을 고치면 2027 인당 값이 같이 바뀌었음. 관리자 > 파트별 인원 모달에서 연도별로 입력하도록 분리(사용자 요청).
- **구조**: `data/headcount.json`에 `parts27`(2027 인원) 추가 — `parts`는 2026 현재 인원 그대로(옛 파일 호환, 실적 보기 분모). `PUT /api/settings/headcount`는 `parts27`을 안 보내면 저장돼 있던 값 유지(`plan_parts`와 같은 방식), 빈 `{}`를 보내면 전부 비움. 계획 보기 인당 3종(`build_plan_summary`)은 `parts27`만 씀 — **2027 인원이 비면 2026 인원으로 대신 채우지 않고 인당 차트에서 빠짐**(조용히 틀린 값이 나오는 것보다 낫다고 판단, 테스트로 고정).
- **화면**: 인원 패널(`PartHeadcountPanel`, 관리자 페이지·상단 바 모달 공용) 위에 "2026년 인원 / 2027년 인원" 칩 — 저장은 두 연도를 같이 보내서 한쪽만 고쳐도 다른 쪽을 안 지움, 저장 안 한 변경이 있는 연도엔 ●. 2027 칩에서 처음 채울 때 쓰는 "2026 인원 불러오기"(입력칸 복사만, 저장은 따로·덮어쓰기 전 확인). 저장 후 `['perf-plan-summary']`도 다시 불러옴. 인당 차트 빈 상태·ⓘ 문구는 "2027 인원" 안내로.
- **차트 배치**: 계획 보기 1·2번(월별 계획 분배, 파트별 27 계획 매출 구성)을 12칸씩 두 줄 → 한 줄. 처음 6 : 6으로 했다가 "반반은 아니다" 지적으로 **8 : 4**(실적 보기 2줄째 원가분석 : 원가 비율 도넛과 같은 비율)로 — 1280px 이하는 위아래(실적 쪽 `span8`과 같은 규칙). 4칸 카드 제목줄의 파이/막대 칩·팀·파트 선택이 좁으면 줄바꿈(`.compControls` flex-wrap) — 화면으로는 못 봄.
- **계획 보기에도 "파트별 인원" 카드**(요청 "2027엔 `_rootDense_` 카드가 없다, 배치도 2026과 동일하게"): 실적 보기와 같은 자리(차트 줄 ↔ 4칸 줄 사이)·같은 한 줄 알약 카드(`ChartCard dense`), 값은 **2027 인원**(`by_part[].headcount`), 라벨 "파트별 인원 (2027)". 모양은 실적 쪽 CSS 모듈(`headcountRow`·`headcountItem`…)을 그대로 import해 씀 — 한 곳만 고치면 두 해가 같이 바뀜. 입력 없으면 "2027 파트 인원이 아직 입력되지 않았습니다" 안내. 2027 인원이 비어 있으면 이 카드·인당 3종이 전부 안내만 보이니 먼저 입력할 것.
- **차트 툴팁(검은 설명창) 흔들림**(요청 "차트 전체적으로 마우스를 움직이면 툴팁이 흔들린다"): Playwright(msedge, 배율 125%, `/api/**`는 Flask 테스트 클라이언트 실데이터)로 월별 차트 위를 훑어 측정 — **같은 막대 안에서는 툴팁 위치 고정·다시 그리기 0번**(마우스를 따라다니는 게 아님), 다만 막대/빈틈을 지날 때마다 툴팁이 Chart.js 기본 400ms 위치 이동 애니메이션으로 미끄러져(약 25프레임) 얇은 막대 위를 움직이면 계속 흔들려 보임. → `BarChart.tsx`에서 `Chart.defaults.plugins.tooltip.animations.numbers.duration = 0`(위치·크기 이동만 즉시, 나타나고 사라지는 페이드는 유지) — Chart가 막대·도넛 공용이라 전 차트 적용. 수정 후 한 번 이동당 툴팁 위치 1곳(미끄러짐 없음). ⚠️ 사용자가 말한 "흔들림"이 이게 아니라 다른 현상(예: 막대가 흔들림)이면 다시 확인 필요 — 이 환경에선 그 외 재현 안 됨(ResizeObserver·불필요한 다시 그리기 없음).
- **원가율 글씨 "(54.8%)"만 자간 소폭 확대**(요청, 월별 두 차트만): 수치 자간(-0.7)과 별개로 `chartTuning.ts monthly.costRate.spacing = -0.1`(-0.3 → "조금만 더" 0 → "아주 미세하게 줄여" -0.1) — `costRatePlugin`이 자기 글씨를 그릴 때만 `letterSpacing`을 걸고(`save/restore`), 값이 없는 원가분석은 이전과 같음. 더 늘리려면 이 값(0에 가까울수록 넓음).
- 월별 두 차트 자간 -1 → **-0.7**("진짜 조금만 늘려도 될 듯", 막대 폭을 줄이고 원가율 둘째 줄을 롤백했으니).
- ⚠️ **위 "둘째 줄" 시도는 롤백됨**(요청 "그래프 퍼센트 수치 위치 롤백") — `INLINE_COST_RATE = false`라 원가율은 다시 막대 위 별도 글씨(`costRatePlugin`). 코드는 남겨 둠(true로 다시 켤 수 있음). 월별 두 차트의 자간 -1(`chartTuning.ts monthly`)은 둘째 줄 때문에 좁힌 것이라 필요하면 -0.3으로 되돌릴 것(막대 폭 0.89는 별개 요청이라 유지).
- **원가율을 수치 라벨의 둘째 줄로(시도, 2026-10-29 요청 "마음에 안 들면 롤백")**: 막대 위에 별도 글씨(`costRatePlugin`, 다른 글자색)로 그리던 "(54.8%)"를 원가 막대 수치 라벨 **아래 줄**로 — 개행만, 글자색은 수치와 같음. 월별 계획 분배(2027)·진도율(월별 실적 추이)·원가분석 3개. `PerformanceChartSection.tsx`의 `INLINE_COST_RATE`(기본 true)로 한 번에 켜고 끔 — false면 플러그인이 예전처럼 막대 위에 따로 그림. 계산은 플러그인과 같은 `costRateText`(매출 대비 원가, 원가분석은 직접+공통 합). ⚠️ 라벨이 두 줄이라 막대 위 높이를 더 쓰므로 최고 원가 막대가 캔버스 위에 닿는지 화면에서 볼 것(진도율 y축 여유 15%, 원가분석 8%) — 잘리면 여유를 늘리거나 false로. 사용자 확인: "이게 나은 것 같다" — 다만 "(50.1%)"가 옆 막대에 닿아 **자간을 좁힘**(`chartTuning.ts` monthly -0.3→-1, profitRate 0→-0.8, 더 좁히려면 이 두 값). ⚠️ **그 뒤 원가분석은 자간을 원래대로(0) 되돌림**("안 좁혀도 될 것 같다") — 아래 `innerLabelSpacing`도 끔(값은 주석, 필요하면 해제). 월별 두 차트만 -1 유지. 이어서 요청했던 것: 원가분석 막대 안 흰색 수치만 자간 넓힘(`innerLabelSpacing` 0.5 — `tightLabelsPlugin`이 그리는 동안 `ctx.fillText`를 감싸 글자색이 흰색일 때만 `whiteSpacing`, 그리기 직후 풀어 툴팁엔 영향 없음, 테스트 4개)과 **진도율·2027 월별 막대 폭을 아주 조금 좁힘**(`monthly.categoryPercentage/barPercentage` 0.92→0.89, 이 두 차트만 쓰는 값).
- **"2026 인원 불러오기" 덮어쓰기 확인을 사이트 공용 확인창으로**: 처음 `window.confirm`(브라우저 기본 창)을 썼다가 지적받아 `confirmDialog`(`utils/dialog`, SweetAlert2)로 교체 — 이 프로젝트는 `window.confirm/alert/prompt` 금지, 항상 `utils/dialog`. 테스트로 확인·취소 두 경우 고정(`PartHeadcountPanel.test.tsx`).
- **계획 보기 상단 안내에 닫기(×)**(요청): 닫은 상태는 `ui.store`의 `planNoteDismissed`(persist, 이 브라우저만).
- **2027 차트를 2026과 같은 글자·자간·% 표시로**(요청 "폰트·자간은 2026/2027 같아야 함, 전동화ㆍ차량개발 두 줄도 안 됐다, 원가율 없다"): 계획 보기 차트 옵션이 따로 값을 갖던 것을 **실적 차트의 `CHART_TUNING`·플러그인 그대로**로 교체 — 월별=`monthly`, 구성·26 vs 27=`planVsActual`, 인당 3개=`perCapita*`. `PerformanceChartSection.tsx`에서 `costRatePlugin`·`tightLabelsPlugin`·`tightTicksPlugin`·`fitBarLabelsPlugin`·`breakAtDotTick`·`costRateTuning`을 export(이름·동작을 바꾸면 양쪽에 반영됨). 카드 `bleedX`도 같게. 예전 2027 쪽은 14px 기본 글씨·자간 0·두 줄 파트명 없음이었음.
  - **% 추가**: 월별 — 원가 막대 위 원가율 "(54.8%)"(실적 진도율과 같은 플러그인, 원가=직접원가) + 제목 옆 "매출/원가 27 계획 합계 … (원가율 N%)"(실적의 "추정 누계 실적" 자리, 계획이라 합계·원가율). 구성 막대 — 칸 안 "N억 / P%"(매출 대비, 칸이 44px보다 좁으면 생략)·막대 끝 "(원가율%)"(`partRatePlugin`, 원가=직접+공통 ÷ 매출). 파이 — 캡션에 선택 범위 원가율. 설명은 4칸 카드라 제목줄 대신 차트 위 한 줄 캡션.
  - **계산은 백엔드**(`build_plan_summary`): `total.cost_rate`(직접+공통÷매출)·`total.direct_rate`(직접원가÷매출, 월별 차트용)·`by_part[].cost_rate`·`by_part[].comp_rate{direct,labor,overhead,mgmt,profit}`(÷27 매출)·`by_team[].cost_rate`. 막대 위 월별 원가율만 실적 차트처럼 플러그인이 값에서 직접 나눔. 테스트 `test_cost_rate_and_composition_shares_are_computed_by_backend`·VM 테스트 2개.
- ⚠️ **서버 재시작 전에 저장하면 2027 인원이 사라짐**: 옛 `write_headcount`는 `parts27`를 모르는 채 파일을 통째로 다시 써서, 화면 저장은 200인데 `data/headcount.json`엔 `parts27`가 안 남음(실제로 13:30 저장이 그렇게 날아감 → "입력했는데 여전히 미입력 안내"). 파일에 `parts27` 키가 없으면 서버가 옛 코드라는 신호. 13:33에 `dashboard_manager.py --start`로 재시작 — **2027 인원은 다시 입력해야 함**.
- ⚠️ Flask 재시작 필요(`headcount.py`·`app.py`·`performance.py`). 처음 열면 2027 인원은 **전부 비어 있어** 2027 인당 차트가 안내 문구만 보임 — 관리자가 2027년 인원을 입력(또는 "2026 인원 불러오기" 후 저장)해야 채워짐.
- 테스트: `tests/test_headcount.py`·`tests/test_perf_plan_view.py` 60개 통과, `PartHeadcountPanel.test.tsx` 4개 추가.

## [2026-10-29] 27년 사업계획 파일 — 2027 계획 뷰(백엔드) · 양식 변경 자동 대응

- **상황**: `data/27년 사업계획 통합관리 파일_ver3.1_취합 완료_261028.xlsx`("양식이 많이 바뀌었다")가 들어옴. 조사 결과 **대시보드는 안 깨졌음** — 이 파일의 `2026년 (9월 집계)` 시트는 옛 양식 그대로라 자동 반영이 10:07에 기존 매핑으로 100% 통과했고, 새 `2027년 (사업계획)` 시트는 이름 규칙(`N월 집계|추정`)에 안 맞아 무시되고 있었을 뿐.
- **2027 시트**: 머리글 11~12행·데이터 13행~·매출/원가 2행 구조는 같고 열 위치·의미가 다름(95열), **기준월·실적 누계 없음**(월별 값은 계획 분배). 열만 맞추면 계산식 검증 전부 100%(실측). 사용자 결정 = **2026 실적 화면 유지 + 2027 계획 보기 추가**.
- **구현(A단계, 백엔드)**: `performance.py` — 뷰 2개(`actual`/`plan27`), `_PERF_COL_MAP_PLAN27`, `is_plan_sheet`·`_resolve_plan_sheet`, `read_perf_frame(view=)`(계획 경로는 jun_actual 재합산·누계 재구성 건너뜀), 계획 뷰 캐시(`_plan_cache`, 실적 전역은 그대로 — ai_insight가 직접 읽음)·`get_perf_df(view="actual")`(인자 없는 기존 호출·테스트 호환), `build_plan_summary`, `/api/performance/views`, `?view=plan27`을 `/summary`·`/data`·`/options`·`/export`가 받음. `perf_autoupdate.py` — `prepare(view=)`, 상태 파일 뷰별 병합 저장(예전 `write_status`는 통째로 덮어써 한 뷰 검증이 다른 뷰 상태를 지움), 기준 시트 스냅샷. `paths.py` — 날짜가 이름 끝에 오는 파일(`…_261028.xlsx`)도 날짜로 정렬(예전엔 수정 시각 폴백이라 날짜 있는 옛 파일보다 뒤로 밀림).
- **양식이 또 바뀌어도 따라가기**(사용자 요구 "매번 Claude에게 맡길 수 없다"): 새 시트의 열 맞추기 기준을 ① 같은 파일 안 같은 종류 시트 ② 직전 파일 ③ **`data/perf_ref_labels.json`(마지막 정상 시트 머리글 스냅샷)** 순으로 — 직전 파일을 data/에서 치워도(경영실적 히스토리로 이동) 자동 정렬이 계속됨. 못 맞추면 직전 파일 유지 + 이유 표시(기존 동작). 지난 시트 맵은 하나도 안 지움(옛 양식으로 되돌아와도 읽힘 — `test_old_actual_maps_are_kept`). **한계**: 열 위치·머리글 변화는 자동, 의미 자체가 바뀐 구조 변경은 사람이 코드로.
- **검증(2026-10-29, 실파일)**: 27 매출(사용 행) **387.49억**·직접원가 244.92억·26 추정 매출 392.2억·경상손익 27 16.5억 / 26 추정 31.12억(블록), 월별 합 = 연 합계, 실적 뷰 불변(계획 321.29·추정 359.91·308행·기준 9월). 테스트 `tests/test_perf_plan_view.py` 24개(합성 xlsx: 열 밀린 새 시트 자동 정렬·검증 실패 시 정지·상태 병합·엔드포인트), 변이 대조로 스냅샷·검증이 실제로 막는지 확인. 전체 122 통과, 기존 재무 14건 실패는 변경 전과 동일.
- **미결/주의**: ⚠️ Flask 재시작 필요. **사용여부가 빈 1건**(세아제강 AI 교육 `생성예정`, 27 매출 0.097억)은 기존 규칙(`사용`만 집계)대로 빠짐 — 시트 자체 합계(387.59억)엔 들어 있어 0.1억 차이. 포함할지는 사용자 판단. 프론트는 아래 "프론트(C단계)" 참고.
- **프론트(C단계, 2026-10-29)**: 필터바 맨 앞 "보기" 칩 = **실제 시트명**(`2026년 (9월 집계)` / `2027년 (사업계획)`, `/api/performance/views`가 줌 — 계획 시트가 없는 파일이면 칩 숨김, 저장된 보기가 계획인데 사라졌으면 실적으로 복귀). 상태 `perf.store.perfView`(팀·파트와 같이 저장). `PerformancePage`가 보기에 따라 `PerformanceActualPage`(예전 그대로) / `PerformancePlanPage`(새로)로 갈림 — **실적 쪽 코드는 안 건드림**(`['perf-summary']` 키·VM·차트 섹션 그대로, 계획은 `['perf-plan-*']` 키·`usePerformancePlanViewModel`·`PerformancePlanChartSection`). 계획 화면 = 카드 7개(26 추정 / 27 계획 + "26 추정 대비 %", `PerfCompareCard`에 `rateLabel`·제목 접미사 `(26 추정/27 계획)` 추가, KPI 순서는 `orderKey`로 따로 저장) · 차트 3개(파트별 26 추정 vs 27 계획 매출, 파트별 27 계획 구성 누적, 월별 계획 분배) · 프로젝트 상세(`perfPlanColumnSet` — 같은 표에 머리글만 `26 추정 …`/`27 …`, 증감 금액 열 추가, 재무 대조·배지 없음). 숨김: 파트별 진행 현황·진도율·인원/인당·인사이트·미수주·재무 대조. 관리자 > 실적현황 파일 패널에 2027 계획 시트 반영 상태 블록. 비율(`rev_rate` 등)은 백엔드가 계산.
- **화면 검증**: Playwright(msedge)로 개발 서버(5188)를 열고 `/api/**`만 **실데이터 응답으로 가로챔**(Flask 테스트 클라이언트가 만든 JSON) — 계획 보기 렌더(카드 392.2/387.5억 등 API와 일치)·칩 전환·새로고침 유지·실적 복귀(321.3/359.9억, 진도율·진행 현황·도넛 그대로) 확인, 오류 없음. ⚠️ 이 환경의 가짜 응답이 부족하면 `UpdateDateField parseYmd` 같은 오류가 남(`/settings/perf-update`는 `{label, note}`, `/download`는 `{files:[]}` 모양이어야 함) — 코드 문제 아님. 계획 보기 엑셀 내보내기(`/data/export?view=plan27`)도 200.
- **교차 검증(2026 시트 vs 2027 시트의 26 값, 실파일)**: ⚠️ **두 시트의 2026 숫자가 다름.** 2027 시트의 "2026년 연간 추정"(Z) 매출 합 **392.2억** vs 2026 `9월 집계` 추정 **359.91억**(+32.3억), "2026년 사업계획"(X) **275.86억** vs 최초계획 **321.29억**. 프로젝트 매칭(코드+이름, 코드만 2차): 278/308 매칭 · 2026에만 30건(추정 30.4억 — K뉴딜 아카데미 2건 23.6억 포함) · 2027에만 52건(Z 98.2억, 27 계획 149.8억 — K뉴딜 `E148600126040002` 하나가 Z 65.1/27 계획 100.0억). 매칭된 것 중에도 추정이 다른 프로젝트 52/278(합 −35.5억), 최초계획 78/278(합 −58.2억) → **오입력이 아니라 2027 시트에서 통합계약 등으로 재정리한 구조 차이**로 보임(`기타. 사업계획 재정리(261013)` 시트). 또 2027 시트 상단(9~10행) 합계 셀(X/Z/AC = 321.29/321.29/317.28)은 같은 열 행 합(275.86/392.2/387.59)과 안 맞음(자기 하단 합계 블록은 행 합과 맞음) — 상단 셀은 믿지 말 것. **그래서 계획 보기의 "26 추정"은 2027 시트가 준 값이고 2026 실적 보기의 추정과 다를 수 있음** — 화면 상단 안내에 명시. 기준을 2026 시트 값으로 바꿀지는 담당자 확인 필요(프로젝트 1:1 대응이 안 돼 합산 대체는 부정확).
- **정리(2026-10-29)**: 안 쓰는 `frontend/public/icons.svg`(참조 없음)·`frontend/ae3_hit.png`(디버그 스크린샷, git 제외)를 지우고, 10-27에 주석으로만 남겨 뒀던 비교 카드 스파크라인("곡선 이미지") 코드와 전용 CSS(`.sparkWrap` 등)를 제거(`KpiCard`의 `Sparkline`은 다른 탭이 써서 유지). `scripts/update_manual_map.bat`(경로가 `D:
gv_dashbord\…`로 고정돼 이 PC에선 못 돌고 저장소 어디서도 참조 안 함)은 사용자 확인 후 삭제(같은 날). 짝인 `scan_manual_folder.ps1`·`make_manual_map.py`는 남김. 서버 재시작 + 실적 반영 확인은 `dashboard_restart.bat`(`scripts/perf_status.py`가 상태 파일을 읽어 보여줌).
- **계획 보기 차트 재배치 + 파이 + 인당 3종(2026-10-29 보고 후 요청)**: 순서 = ① 월별 계획 분배 → ② 파트별 27 계획 매출 구성 → ③ 한 줄 4칸 `파트별 26 추정 vs 27 계획 매출 · 인당 매출 · 인당 관리비 · 인당 손익`(실적 보기 3줄째와 같은 순서). 구성 카드는 **파이(기본, 하나씩 보기) ↔ 막대(파트 비교) 전환** + 파이에서만 전체·팀·파트 선택(`CostFilterPopover` 재사용, 상단 팀·파트 필터와 따로 — 실적 보기 "전체 평균 원가 비율" 도넛과 같은 방식). 처음엔 도넛을 빼고 누적 막대로만 했다가(계획서와 달랐는데 보고를 빠뜨림) 보고 후 파이를 더함. 인당 3종 = **27 계획 금액 ÷ 파트 인원**(실적 보기의 "현재 인원"과 같은 `data/headcount.json` 값 = 실적 쪽이 추정을 나누는 그 인원), 같은 함수(`headcount.per_head_fields`)·같은 제외 규칙(인원 미입력, 팀 필터 + 여러 팀에 걸친 파트는 제외하고 제목 옆 "N개 파트 제외"). 백엔드 `by_part.rev_per_head·profit_per_head·mgmt_per_head·headcount·headcount_partial`. 실데이터: AIㆍDS 38.34억 ÷ 8.8명 = 4.36억. ⚠️ K뉴딜TF는 인원 3.3명으로 입력돼 인당 매출 33.6억으로 튐(실적 보기와 같은 규칙의 결과 — 입력 인원 확인). 테스트: `tests/test_perf_plan_view.py` +2(인당·팀 필터), `usePerformancePlanViewModel.test.ts` 5개(인당 제외·억 단위 버림·파이 범위). 화면은 Playwright로 확인(파이 기본·파트/팀 선택 제목 반영·막대 전환 시 필터 숨김).
- **2026은 12월까지 바뀜**: 실적 보기는 월 집계 시트(`2026년 (N월 집계)`)가 새로 오면 기존대로 자동 반영(변경 없음). 계획 보기의 26 추정(Z)은 시트에 입력된 값이라 월 집계가 갱신돼도 **같이 안 움직임**(기획 쪽이 시트를 고쳐야 바뀜). 다음 파일에 2027 시트가 없고 이전 파일도 data/에 없으면 계획 칩은 사라짐.

- **재무 탭 필터 변경 시 스피너**(요청: 상단 헤더 필터를 바꾸면 비동기 재조회 동안 아무 표시가 없음 — "조금만 나올지라도 있는 게 낫다"): 원인 = `createDataHook`이 `keepPreviousData`라 이전 값이 그대로 남아 있어 로딩/재조회를 구분할 신호가 화면에 없었음(첫 로딩만 스켈레톤). KPI 탭은 첫 로딩 스피너(`QueryGate`)·표 `.fetching` 흐림이 있었음.
  - **구조**: 공용 `components/ui/RefreshSpinner`(부모 전체를 덮는 투명 레이어 + sticky 스피너 카드 — 스크롤해도 화면 안에 머묾, 클릭 통과, 부모가 `position: relative`여야 함) + `hooks/viewmodels/useFinancePageViewModel`(`isRefreshing = useSummary().isFetching && !isLoading` — 같은 쿼리라 추가 요청 없음). `FinancePage`가 KPI 카드·차트·파트 표 섹션을 `FadeInSection refreshing`(살짝 흐림)으로, `<main>` 끝에 `RefreshSpinner`를 둠.
  - **스피너 한 개만**: 섹션마다 `FadeInSection` 안에 넣으면 KPI 카드 줄(높이 ~100px)에서 스피너 카드가 넘치고 4개가 한꺼번에 떠서 페이지 단위 1개로 함. `Spinner`가 0.12초 뒤에 페이드인(`Spinner.module.css`)이라 캐시로 즉시 끝나는 조회엔 안 번쩍임 — "아주 짧아도 보이게"는 이 지연 때문에 120ms 미만 응답엔 안 뜸(원하면 지연 조정).
  - ⚠️ **처음엔 엉뚱한 페이지에 붙였음**(3G 테스트에서 안 떠서 발견): 네비의 "경영실적/재무데이터" 탭 = `PerformancePage`이고, `FinancePage`는 네비에서 빠진 옛 탭(`/finance` 주소 직접 접근용)임. 헤더 필터(팀·파트)·"흐려짐"이 있던 곳도 실적 탭. → **`PerformancePage`에도 `<RefreshSpinner active={vm.isSummaryFetching} />`**(`.main`에 `position: relative`) 추가. `FinancePage` 쪽은 그대로 둠(무해). "재무 탭"이라고 하면 실적 탭을 뜻할 수 있으니 확인할 것.
  - **범위**: 트리거는 요약(`/api/summary`)만 — 프로젝트 재무 상세 표의 페이지·정렬·검색·자체 셀렉트는 기존 표 흐림 그대로(페이지 넘길 때마다 전체 스피너가 뜨면 과함). 실적 탭(`FadeInSection refreshing`은 흐림만)·KPI 탭 필터 재조회는 이번에 안 건드림 — 같은 방식(`RefreshSpinner` + 해당 VM의 isFetching)으로 붙이면 됨.
  - **검증**: `npx tsc -b` 통과, `RefreshSpinner.test.tsx` 2개·`FadeInSection.test.tsx` 3개 통과. ⚠️ **화면 확인은 못 함**(Playwright 미설치) — sticky 위치(`top: 38vh`)·카드 크기는 실제로 보고 조정 필요.

- **화면 전환·값 변경 모션 정리**(요청 "애니메이션 없는 부분 없으면 좋겠다", 계획 `~/.claude/plans/generic-floating-taco.md`): 조사 결과 모달·드롭다운·표 페이지 전환·막대 차트는 이미 움직이고, 끊기던 곳을 메움.
  - **토대**: `index.css`에 모션 토큰 `--dur-fast/base/slow`(0.15/0.25/0.5s)·`--ease-out`·`--ease-inout` — 새 코드는 이 값을 쓰고 기존 하드코딩은 점진 교체(속도 조절은 여기 한곳). 전역 reduced-motion 안전망(`*{animation/transition-duration:.01ms}`), `useCountUp`·Chart.js 막대/도넛 애니메이션에 `prefersReducedMotion` 가드.
  - **카드 값**: `useCountUp`을 **지금 값 → 새 값**으로 이어 가게 재작성(예전엔 매번 0부터라 필터 바꿀 때 0으로 떨어졌다 올라옴; 첫 렌더만 0부터, 도중 변경은 그 값에서 이어감, 마지막 프레임은 정확히 target). 비교 카드는 `useCompareCardViewModel`(hooks/viewmodels)이 계획/추정 값을 카운트업, 끝난 프레임은 VM 문자열 그대로(표시 규칙 유지). 배지·"계획 대비 %"·보조 줄은 값이 바뀔 때 짧은 페이드(key). 카드 로딩 중엔 빈 영역 대신 스켈레톤 7개 → 도착 시 페이드.
  - **테마 전환**: `theme.store` subscribe가 전환 직후 450ms만 `<html>`에 `theme-switching`을 붙이고 `index.css`가 그 동안 모든 요소의 색을 서서히 전환(예전엔 body 배경만). 상시 전환이 아니라 hover 등과 안 섞임.
  - **탭 이중 재생 제거**: `FadeInSection`이 `fadeUp`을 **처음 한 번만**(animationend로 클래스 제거 — transform이 안 남아 fixed 기준도 안전). 탭 복귀 땐 `tabFadeIn`만.
  - **재조회 흐림**: 요약(카드·차트)을 다시 불러오는 동안(`isSummaryFetching`, 첫 로딩 제외) 섹션이 0.65로 흐려졌다 돌아옴 — 흐려지기 시작을 0.15초 늦춰 캐시로 빨리 끝나는 건 깜빡이지 않음(`.refreshable/.refreshing`). 스피너도 0.12초 뒤 페이드인.
  - **Playwright 실측**(msedge, `/api/**` 가짜): 첫 로딩 308→343→357→360, 필터 변경 360→277→234→206→…→180(이어서 변함), 탭 왕복 후 `.fadeUp` 0개, 테마 흰색→168→51→23→14(남색) 전환, reduced-motion에선 전부 즉시.
  - **이번에 안 한 것**: 차트 그리드가 테마·상태 전환 때 `key`로 리마운트돼 재생되는 것(깨지진 않음), 탭 나가기 애니메이션, `QueryGate` 크로스페이드·`Suspense fallback={null}`, 표 정렬 전환(`usePageSwapClass` 키에 정렬 추가는 모든 표에 영향) — 필요하면 따로. 테스트 `useCountUp.test.ts`(5)·`FadeInSection.test.tsx`(3)·`theme.store.test.ts`(1).
- **공통원가 카드 팀·파트 필터 시 계획 칸 '-'**(정정): 필터 중 계획 공통원가는 전사 값뿐이라 팀별 값이 없는데, 백엔드가 추정으로 대체한 값을 그대로 계획 칸에 보여 계획=추정·차이 +0.0으로 보였음("틀렸다고 해도 됨" — 처음 만든 방식이 오해 소지) → `plan_overhead_source === 'estimate'`면 계획 칸 '-'·차이 배지 없음·계획 대비 % 없음(백엔드는 이미 None). 매출이익 카드 계획 칸(`plan_gross`)은 여전히 추정 공통원가로 대체한 값이라 팀 선택 시 근사치 — 같은 방식으로 '-' 처리할지는 미결.
- **모달 ESC 닫을 때 검은 테두리 수정**(파트별 매출 실적 진행 현황 행 → 드릴다운 모달): 원인 = 모달을 연 행 버튼에 포커스가 남아 있다가 ESC(키보드)로 닫으면 브라우저가 키보드 사용으로 보고 전역 `:focus-visible`(`index.css`, 2px `--brand-mid` = `#001D3F` 거의 검정)를 그 버튼에 그림. 마우스 ×로 닫으면 포인터 모드라 안 보였음. Playwright로 재현(ESC 후 `BUTTON.rowClickable`, outline `solid 2px rgb(0,29,63)`) → 수정 후 `BODY`·outline none. **수정**: 공용 `ModalShell`이 열릴 때 포커스를 패널로 옮김(`tabIndex=-1` + `.modal:focus-visible {outline:none}`, 모달 안 입력칸이 이미 포커스면 안 뺏음) — 같은 구조의 모든 모달에 적용. 포커스를 열었던 버튼으로 되돌리는 정석(a11y)은 일부러 안 함(되돌리면 ESC 뒤 같은 테두리가 다시 뜸). `Modal.focus.test.tsx` 2개.

## [2026-10-27 저녁] 추출 현황 "원본 수정됨" 표시

- **왜**: 누가 NAS PPT를 고쳐도 추출 현황은 처리이력에 한 번이라도 있으면 "반영됨"으로만 보여, 재추출이 필요한지 알 길이 없었음. 내용은 안 열고 **날짜만** 비교(요청).
- **규칙**: 파일 수정 시각(`os.stat` mtime) > 그 파일의 마지막 처리일시 → `modified`. `extract_coverage._file_mtimes`가 파일명별 mtime(같은 이름 여러 곳이면 가장 늦은 것), `_source_coverage`가 항목마다 `modified`·`modified_at`, 소스마다 `modified_count`. **상태(extracted 등)와 별개 표시**라 `counts`엔 안 넣음(막대 비율·파일 수 겹쳐 세기 방지). 실패·미처리 파일은 이미 따로 표시돼 제외. 폴더 날짜는 안 봄(파일이 오가면 계속 바뀜 — 요청).
- **화면**: 관리자 > PPT 추출 모달의 추출 현황(`ExtractCoverage`)에서만 — 카드 머리 "확인 필요 N건"에 합산, 범례 끝 "원본 수정됨 N"(막대엔 없음), 실패·미처리와 함께 펼친 목록에 "원본 수정됨" 알약 + "마지막 추출 … → 원본 수정 …". 노란 "!"(데이터 이상)·업데이트 요청 기능은 그대로.
- **실측**(NAS, 10-27): 재무·KPI 각 3건(같은 파일 몇 개), 계산 5.9초(파일 263개 stat 포함). 오탐 여지: 열어서 저장만 해도 mtime이 바뀜(놓치는 쪽보다 낫다고 판단). DRM 파일은 지금 로컬 사본으로 열어 mtime 안 바뀜.
- ⚠️ Flask 재시작 필요(`extract_coverage.py`). 테스트 `tests/test_extract_coverage.py` 4개, `tsc -b` 통과.
- **실적 탭 다듬기**(요청): ① 계획/추정 비교 카드(매출·직접원가·공통원가·매출이익)의 **미니 2막대(`.bars`) 주석 처리**(`PerfCompareCard.tsx` — JSX와 높이 변수를 같이 주석, 복구 시 같이 해제; CSS는 그대로). ② 진도율 제목 옆 "매출/원가 추정 누계 실적" 글자 키움(`.cumNote` `font-size: 1rem`). ③ 막대 수치 14 → **12px**(원가분석과 같게) — 계획 vs 추정 매출·인당 매출·손익·관리비 4개(`chartTuning.ts labelFontPx`). ④ **인당 손익 막대 색** = 경상손익 색 역할 `palette.costProfit`(기본 빨강)으로 전부 통일(예전: 플러스 `profit` 파랑 / 마이너스 `loss` 빨강). 차트 색상 모달에서 경상손익 색을 바꾸면 같이 바뀜. 화면 확인은 안 함(tsc·vitest 통과).
- **관리비·경상손익 카드도 계획/추정 비교형**(요청): 예전엔 추정만 있는 단일값 카드. 계획 값은 계획 공통원가와 같은 **시트 합계 블록**(매출/원가/공통원가/인건비/자산/관리비/손익)의 '관리비'·'손익' 줄 최초사업계획 열 — 9월 집계: **계획 관리비 44.31억(4,430,525천원), 계획 경상손익 9.53억(953,426천원)**, 추정은 기존 `cost_mgmt` 합 / `operating_profit` 합(16.58억). 검증식: 손익 = 매출 − 원가 − 공통원가 − 인건비 − 관리비(**자산 줄은 안 들어감**: 321.29−193.51−20.33−53.61−44.31 = 9.53억, 차이 0.00005억). `performance._plan_mgmt_profit_from_block`이 줄 라벨 순서·매출/원가 합 일치·위 항등식(오차 100천원)이 다 맞을 때만 믿고, 아니면 None. 응답 `total.plan_mgmt`·`plan_operating_profit`. **팀·파트 필터 중이면 None → 카드 계획 칸 '-' + 차이 알약 없음**(공통원가처럼 추정으로 대체하지 않음: 계획=추정으로 보여 오해). 보조 줄(관리비 "매출 대비 N%", 경상손익 "손익률 N%")은 처음 제목 아래(labelNote)로 옮겼다가 **값 바로 아래 원래 자리로 복귀**(`PerfCompareCard` `sub` — 값 위치가 다른 카드와 어긋나지 않게 absolute로 매닮). 카운트업 애니메이션 단일값 카드·변수는 주석으로 보존(`usePerformanceViewModel.ts`). 이제 카드 6개 모두 compare 폭(`.wide`). ⚠️ Flask 재시작 필요(`performance.py`). 테스트 `tests/test_perf_plan_block.py` 4개, `PerfCompareCard.test.tsx` 2개 추가.
- **인건비 카드 추가**(요청, 계획/추정 비교형): 계획 = 합계 블록 '인건비' 줄 925행 W열(5,361,140천원 = **53.61억**, `plan_labor`), 추정 = 매출행 인건비 합(`cost_labor`, 현재 9월 맵 기준 BD열 — 8월 이전 문서의 BC는 R열 삽입 전 위치) **55.98억**. 관리비·경상손익과 같은 규칙(필터 중·못 읽으면 계획 '-'). 카드 순서 = 매출 · 직접원가 · 공통원가 · 매출이익 · **인건비** · 관리비 · 경상손익(`DEFAULT_KPI_ORDER`, 저장된 순서는 매출이익 뒤에 끼워 넣음). **한 줄 카드 7개** — 노트북 폭에서 빡빡하면 줄 나누기·폭 조정 필요. ⚠️ Flask 재시작 필요.
- **비교 카드 스파크라인 → 삭제**(요청 "카드들 그래프 곡선 이미지 삭제"): 10-27에 넣었던 오른쪽 하단 스파크라인(방향별 색 포함)을 `PerfCompareCard.tsx`에서 주석 처리(복구 시 주석·import 해제, CSS는 그대로). 실적 탭 카드만 — 다른 탭의 `KpiCard` 스파크라인은 그대로.
- **비교 카드 값 글자 되돌림**(요청): 카드 7개로 폭이 좁아진 데다 값 글자 크기 식(`--cmp-value-fs`)이 주석 처리된 미니 막대 자리 86px을 계속 빼서 바닥(0.95rem)까지 줄었음 → 차감 제거(`100cqw / 7.6`, 최대 2.1rem). 막대를 복구하면 차감도 되살릴 것.
- **카드 상단 바 색 = 차트 색상 역할**(요청): 계획/추정 카드 상단 2px 바를 accent(brand/purple…) 대신 차트 팔레트 역할 색으로 — 매출 `revenue` · 직접원가 `costDirect` · 공통원가 `costOverhead` · 매출이익 `profit`(마이너스면 `loss`) · 인건비 `costLabor` · 관리비 `costMgmt` · 경상손익 `costProfit`(기본 빨강). VM은 역할 이름(`colorRole`)만 주고 실제 색은 `PerfCompareCard`가 `useChartPalette()`로 읽음 → 차트 색상 설정·주간/야간이 같이 반영. 역할이 없으면 예전 accent 색.
- **인당 차트 기본 순서**(요청): 3줄 = 계획 vs 추정 매출 · 인당 매출 · **인당 관리비 · 인당 손익**(`DEFAULT_CHART_ORDER`에서 둘을 맞바꿈 — 손익이 먼저였음). 순서는 드래그할 때만 저장(`performance-chart-order-v8`)이라 직접 옮겨 둔 브라우저는 그 순서 유지, 안 옮긴 브라우저는 새 기본값.
- **카드 제목 줄바꿈**(요청): 좁은 카드(≤300px)에서 "당해 연도 직접 원가 (계획/추정)"가 "…직접 / 원가 (계획/추정)"로 끊기던 것 → `.label`의 `text-wrap: balance`를 `wrap`으로(첫 줄을 최대한 채움: "당해 연도 직접 원가" / "(계획/추정)"). 폭이 더 좁아 첫 줄에 안 들어가면 여전히 넘어갈 수 있음.
- **카드 제목 "(계획/추정)" 항상 둘째 줄 + 매출이익 계산식 값 아래로**(요청): `PerfCompareCard`가 제목 끝 "(계획/추정)"을 떼어 `.labelSuffix`로 따로 줄을 나눠 그림(앞부분 `.labelMain`) — 이전의 `text-wrap` 조정은 이걸로 대체됨. 매출이익 카드의 "매출 - (직접원가 + 공통원가)"는 제목 아래(labelNote)에서 **값 아래 줄(`sub`, 관리비 "매출 대비 N%"와 같은 자리)**로 이동 → 머리글 높이는 두 줄 분량(2.6)으로 유지. 아주 좁은 카드에서 제목 앞부분이 두 줄로 꺾이면 그 카드 머리글만 커질 수 있음.
- **카드에 "계획 대비 추정 %" + 머리글-본문 간격 축소**(요청): 추정 값 위 오른쪽 정렬로 "계획 대비 112.0%"(`PerfCompareCard` `.rateRow`/`.rate`, 값이 없어도 줄 높이는 유지). **계산은 백엔드** — 응답 `total.est_plan_rate`(카드 id → 추정 ÷ 계획 × 100, `_vs_plan`: 계획 없음·0 이하면 None). 9월 집계: 매출 112.0 · 직접원가 117.1 · 공통원가 93.2 · 매출이익 106.4 · 인건비 104.4 · 관리비 94.3 · 경상손익 173.9%. 팀·파트 필터 중엔 계획이 없는 인건비·관리비·경상손익과, 계획이 추정으로 대체되는 공통원가(100% 무의미)는 비움. 색은 중립(저조 낙인 금지 원칙). 간격: 값 묶음(`.valuesWrap`)을 세로 가운데(center)에서 **위쪽 붙임(flex-start)**으로 — 머리글 바로 아래부터. ⚠️ Flask 재시작 필요.
- **카드 왼쪽 여백 축소**(요청 "numPart 보면 왼쪽 여백 필요없을듯, 카드 전부"): 비교 카드 왼쪽 안쪽 패딩 22 → 14px(≤1024px는 18 → 12px) — 제목·값이 같이 왼쪽으로. 만약 뜻이 숫자 글꼴의 고정폭(`tabular-nums`, '1' 앞 빈칸)이었다면 `.numPart`의 `font-variant-numeric`을 빼면 됨.
- **카드 머리글·값 정렬 수정**(요청): ① 값 아래 문구(`.sub`: "매출 - (직접원가 + 공통원가)" 등)가 큰 숫자 첫 글자보다 왼쪽으로 튀어나오던 것 — 큰 글꼴 첫 글자 앞 여백(≈0.1em)을 `.valuesWrap .values { margin-left: calc(var(--cmp-value-fs) * -0.1) }`로 상쇄해 제목·값·문구 왼쪽 선을 맞춤. ② 제목은 두 줄 고정(앞부분 `.labelMain` / "(계획/추정)" `.labelSuffix`, 머리글 min-height 두 줄)이라 카드마다 값 높이가 같음. ③ 차이 배지는 **원래 자리(오른쪽 위) 유지**(중간에 둘째 줄로 내렸다가 "왜 바꼈냐"는 지적으로 복구), 대신 글자 0.74→0.66rem·좌우 여백 8→6px로 줄이고 제목 앞부분이 안 들어가면 …로 줄임(툴팁에 전체 제목). Playwright(msedge, `/api/**`만 가짜 응답)로 1600·1366px 캡처 확인: 1600px에선 "당해 연도 직접 원가"만 잘림, 1366px에선 대부분 "당해 연도 …"로 잘림 → 더 좁은 노트북이 중요하면 제목에서 "당해 연도" 빼기 또는 배지를 둘째 줄로 내리는 안 필요.
- **관리자 페이지 섹션 순서**(요청): 실적현황 파일·PPT 추출을 붙이고 **파트별 인원은 맨 아래**(상단 바 사람들 아이콘으로 모달도 열리니까). 순서 = 화면 설정 · 차트 색상 · 실적현황 파일 · PPT 추출 · 재무 불일치 · 시크릿 키 메일 · 파트별 인원(`AdminPage.tsx` `SECTIONS`와 본문 `Block` 순서를 같이 맞출 것, 맨 아래 센티널은 마지막 섹션 = 파트별 인원을 켬).

## [2026-10-27] 공통원가 카드 추가 · 계획 인원 전부 주석 처리

- **공통원가 카드**(`overhead`, 계획/추정 비교형): 직접 원가와 매출이익 카드 사이(`DEFAULT_KPI_ORDER` = revenue·cost·overhead·grossProfit·mgmt·profit). 추정 = `total.cost_overhead`(매출행 BD 합), 계획 = `total.plan_overhead`(시트 합계 블록 사업계획 기준, Flask 재시작 전엔 추정값으로 폴백). 팀·파트 필터 중엔 계획도 추정 공통원가로 대체(`plan_overhead_source`). 저장된 카드 순서는 기존 병합 로직이 `cost` 뒤에 끼워 넣음. 카드가 6개가 돼 한 줄이 빡빡하면 폭을 다시 볼 것.
- **계획 인원 전부 주석 처리**(요청): 관리자 > 파트별 인원(페이지 섹션·모달 공용 `PartHeadcountPanel`)의 계획 인원 박스, 실적 탭 파트별 인원 카드의 계획 줄, **인당 매출 차트의 계획(억) 막대**(계획 인원이 분모라 같이 뺌 — 추정 1막대만), 인당 차트 툴팁의 "인원 계획 N명", ⓘ 문구, 백엔드 응답 `plan_headcount`·`rev_per_head_plan`(`headcount.per_head_fields`, `performance.py`). 저장은 `parts`만 보냄 — 서버는 `plan_parts`를 안 받으면 저장돼 있던 값을 유지하므로(`app.py`) `data/headcount.json`의 계획 인원은 그대로 남음. 복구하려면 각 주석("계획 인원 주석 처리(2026-10-27)")을 해제. 테스트 `tests/test_headcount.py` 계획 관련 단언은 "응답에 없음"으로 바꾸고 원래 케이스는 주석으로 보존.
- **UI 단순화**: 계획 인원 박스가 빠져 모달·관리자 섹션의 `.boxes`를 2열 → 1칸 전체 폭, 파트 항목 `.list`를 `repeat(auto-fill, minmax(260px,1fr))` 다열로(오른쪽 빈 여백 해소). 실적 탭 파트별 인원 카드는 두 줄 묶음(`headcountRows`)·고정 폭 라벨·"-" 분기를 걷어내고 "파트별 인원 + 알약 목록 + 합계" 한 줄로. 줄에 혼자라 순서를 바꿀 일이 없는 `headcount` 카드는 **드래그 핸들을 안 그림**(`SortableChart noHandle`). 원래 구조는 주석으로 보존.
- **파트별 인원 카드 높이 축소**: `ChartCard`에 `dense` prop 추가(빈 제목줄 생략 + 안쪽 여백 20/24/16 → 10/16) — 카드 높이 약 76px → 47px, 라벨은 알약과 세로 가운데 정렬. 제목 없는 한 줄짜리 카드용.
- **파트별 인원 소수 첫째 자리**(파트타임·겸임 0.5명 등): `headcount._num`이 0~999, 소수 첫째 자리까지 허용(둘째 자리 이상은 거부, 정수로 떨어지면 int로 저장). 입력 패널(관리자 페이지·모달 공용)은 입력칸 `step=0.1`, ± 버튼은 1씩(소수는 `roundHeadcount`로 오차 정리), 합계는 `formatHeadcount`. 실적 탭 인원 카드·인당 차트 툴팁도 `4.5명` 형식(정수는 그대로 `5명`). 인당 계산은 원래 나눗셈이라 변경 없음. `utils/format.ts`에 `roundHeadcount`·`formatHeadcount` 추가, 테스트 추가. ⚠️ Flask 재시작 필요(`headcount.py`).
- **실적 탭 차트 디테일 조절표**(`PerformanceChartSection/chartTuning.ts`, 요청: 월별 차트처럼 다른 차트도 여백·크기·자간을 세밀하게): 진도율·원가분석·계획 vs 추정 매출·인당 매출/손익/관리비 6개 차트의 **여백(padding)·막대 굵기(categoryPercentage/barPercentage)·수치 글자 크기·자간·축 글자 크기/자간·카드 최소 높이·원가율 위치(lift/fontPx)**를 `CHART_TUNING` 표 한곳에서 고침. 처음 값은 이전 화면과 동일(월별은 사용자가 직접 만진 값 그대로 이전). 각 옵션 함수(`monthlyOptions`·`partRevCostOptions`·`planVsActualOptions`·`perCapitaChartOptions`)가 표를 읽음. 플러그인 확장: `tightTicksPlugin`이 `plugins.tightTicks`({spacing, axes})를, `fitBarLabelsPlugin`이 `fontPx/spacing`를 옵션으로 받음, 자간 `tightLabelsPlugin`을 6개 차트 모두에 적용. 인당 차트 3개는 공통 옵션 → **차트별 옵션**으로 분리(예전엔 손익에 마이너스가 있으면 매출·관리비 차트 왼쪽도 48px 비웠음 → 이제 `leftIfNegative`가 있는 손익만). `PROFIT_PADDING` 상수 삭제. 극단값으로 임시 변경해 반영 확인 후 원복.
- **가로 막대 4개 차트(계획 vs 추정·인당 3개) 여백 축소·그래프 확대**: `chartTuning.ts` — `padding.top` 30 → 8(수치가 막대 옆에 찍혀 위 여백 불필요, 제목~첫 막대 빈 띠 70px → 33px), `padding.left` 4 → 0, 새 `bleedX: 14`(`ChartCard bodyBleedX` — 제목은 그대로 두고 그래프 영역만 카드 좌우 안쪽 여백 24px 쪽으로 14px씩 넓힘), `tickSpacing` -1 → -1.6(긴 파트명 "전동화ㆍ차량개발" 자간). 눈금 개수·`억` 단위 통일·축 최댓값 정리는 사용자가 "3번만 맞음"이라 안 함.
- **긴 파트명 두 줄 표시**(`chartTuning.ts breakTickAtDot`): 가로 막대 4개 차트에서 "전동화ㆍ차량개발"처럼 7자 이상이고 가운데점(ㆍ)이 있는 이름을 점 자리에서 두 줄("전동화ㆍ"/"차량개발")로 — 축 칸이 좁아져 그래프가 넓어짐. Chart.js 눈금 `callback`이 배열을 돌려주는 방식(`breakAtDotTick`)이라 라벨 데이터·클릭(드릴다운)·툴팁은 원래 이름 그대로, "AIㆍDS" 같은 짧은 이름은 한 줄(`BREAK_AT_DOT_MIN_LEN`=7).
- **파트별 인원 ± 버튼 0.1씩, 파트당 상한 100명**: `PartHeadcountPanel` `STEP=0.1`·`MAX_HEADCOUNT=100`(입력칸에 상한 초과로 적으면 100으로 맞춤), 서버 `headcount.HEADCOUNT_MAX` 999 → 100(둘이 같아야 함). 기존 저장값이 100 초과면 읽을 때 빠짐. ⚠️ Flask 재시작 필요.
- **차트 드래그 시 미니 카드 안 보임 수정**(스크롤 내린 상태의 파트별 차트 줄): `DragOverlay` 미니 카드는 `position: fixed`인데 페이지 래퍼(`.fadeUp`)의 transform 때문에 fixed 기준이 화면이 아니라 래퍼가 돼, 스크롤하면 카드가 화면 위 밖(y<0)에 그려졌음(원래 카드는 흐려지기만 해 "뭐가 옮겨지는지" 안 보임). `createPortal(<DragOverlay/>, document.body)`로 해결. Playwright(msedge)로 드래그 중 위치 재현·확인. ⚠️ 앞으로 transform 걸린 래퍼 안에서 fixed 요소를 쓰면 같은 문제 — 포털로.
- ⚠️ Flask 재시작 필요(`headcount.py`·`performance.py`). 검증: `pytest tests/test_headcount.py` 25개, `npx tsc -b`, `vitest` 98개 통과.

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
