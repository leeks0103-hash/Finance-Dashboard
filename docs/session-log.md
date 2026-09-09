# 세션 진행 기록

## [2026-09-09] KPI 값 수동 검증 → dedup 코드 충돌 버그 발견·수정 + UI 다수 정비

**배경**: 사용자가 KPI 집계(NPS·신사업 매출액 등) 값을 프로젝트코드 단위로 직접 대조 검증하는 과정에서 발견

**1. KPI 집계 dedup — 코드 충돌로 다른 프로젝트가 통째로 삭제되던 버그** (가장 중요)
- 검증 중 "정부지원 사업 및 신사업 확대(매출액)" 26년 목표(129.3억)에 사용자가 직접 뽑은 리스트를 대조하다가, 엑셀엔 있는 값(`미정`코드 1.2억)이 계산에서 빠진 것 발견
- 원인 규명: `프로젝트코드="미정"`을 **서로 다른 프로젝트 2개**가 공유 — `_dedup_by_stage_priority`가 코드+연도만으로 묶어서 이걸 "같은 프로젝트의 다른 단계"로 오인, 값 없는 행만 남기고 진짜 값(1.2)을 버림
- 전수 스캔해보니 placeholder 코드(생성예정·미정·선정 시 생성 예정 등)뿐 아니라 **"정식 코드" 형식인데도 데이터 입력 실수로 충돌하는 사례**까지 발견(`E158600126060001`이 완전히 무관한 두 프로젝트에 붙어있음) — 실측 46개 다건 그룹 중 **10개(22%)가 이런 충돌**
- 해결: `strip_stage_suffix()`(파일명에서 보고단계 표시 제거)를 `extract_kpi_ppt.py`에서 `shared.py`로 옮겨 공용화, `kpi.py`의 dedup 키를 `(코드,연도)` → `(코드,연도,파일명 기준명)`으로 확장 — 코드가 같아도 실제 다른 프로젝트면 분리
- 검증: dedup 108건 → **128건** 회복, 신사업 매출액 목표 129.3 → **142.0억**. 기존 테스트 `test_kpi_units`/`test_shared` 32/32 통과
- 알려진 한계 1건: `E141600926040001`은 완료·제안 두 PPT 파일명이 "26년_" vs "26년 "(언더바 유무)로만 달라 기준명이 갈라짐 — 현재 데이터는 값이 같거나(N/0) 스킵값이라 영향 없었지만 완전한 판별은 아님
- ⚠️ Flask 서버 재시작 필요(`/api/kpi/reload`는 엑셀만 재로드, 코드는 반영 안 됨)

**2. KPI 값 검증 과정에서 발견한 별도 버그 — 파트 필터가 새 옵션값을 계속 놓치던 문제**
- 증상: KPI 취합 173건인데 대시보드엔 171건 — 원인은 파트 `"-"`(파트 미인식 2건)가 필터 선택에서 빠져있던 것
- `createFilterStore`(재무·KPI 공용)의 `initializeDefaults`가 **최초 방문 1회만** 실행되고 잠기는 구조라, 나중에 새로 생긴 옵션값이 옵션 목록엔 나타나도 기존 필터 선택엔 자동 반영이 안 됐음
- `syncOptions`로 교체 — 최초엔 전체선택, 이후엔 옵션이 바뀔 때마다 그동안 없던 새 값만 자동 추가(사용자가 일부러 해제한 값은 유지). persist 키 v2로 기존 사용자도 1회 재초기화
- 재무 탭도 같은 store 공유라 동일 수정 적용됨

**3. 텍스트/UI 정리**
- 손익율→손익률, 증감율→증감률(맞춤법 — 같은 컬럼인데 CSV/카드/ⓘ설명은 이미 손익률이었음), 신사업_매출억→신사업_매출액(표시만 교정)
- 적절성(0~5 척도) 항목 소수점 첫째자리 통일: 값이 정수로 떨어져도 "4.0"으로 표시(KPI 집계 표 + 차트 datalabel + KPI 취합 rowspan 뷰 전부)
- KPI 목표 vs 실적 차트: 막대 각지게(`borderRadius 0`), 목표/실적 막대 사이 간격(`barPercentage 0.82`)
- KPI 집계 컬럼 순서 변경(KPI항목→26년 목표(사업계획)→집계방식→...) + 고정값 컬럼(필터 무관) 음영 표시 — `DataTable`에 `ColumnMeta.staticCol`/`staticColShade` prop 신설(다른 테이블도 재사용 가능), 음영이 진하다는 피드백으로 KPI 집계만 연한 톤(`staticColShade="soft"`)
- 파트별 실적 테이블: "누계 실적"→"누계매출"
- 실적현황 KPI 카드 순서 변경(계획→누계 실적→추정 실적(연간)→경상손익) + `PerformanceKpiSection` 신설로 차트처럼 드래그 순서 변경 가능(우측 상단 핸들, localStorage)
  - 최초 구현 버그: 저장된 순서 없을 때 `order` state를 빈 배열로 시작해두고 렌더링은 별도 병합 로직으로 처리 → `handleDragEnd`가 빈 배열에 `arrayMove`를 적용해 항상 무효화(드래그 애니메이션만 보이고 드롭 후 원위치로 복귀). `PerformanceChartSection`과 동일하게 `order` 자체를 기본값으로 채워서 시작하도록 수정

**다음 세션 과제**
- `test_finance_api.py`/`test_finance_load.py` 14건 실패 확인 — 이번 세션 변경과 무관한 기존 버그(`git stash`로 되돌려도 동일 실패). `finance.py` `EXCEL_COLS`가 16컬럼인데 `conftest.py` fixture가 15컬럼만 생성해서 나는 에러 — 다음 세션에 수정 필요
- KPI 집계 dedup 수정 후 나머지 7개 항목(NPS·전략기술·특화체계·AI교육 등) 값이 전부 바뀜 — 사용자 재검증 권장
- 재무 비고 검색 안 됨 문제 (여러 세션째 이월, 계속 보류)

---

## [2026-09-08 오후] 배경/테이블 색 재편 + 프로젝트 병합 키 수정 + UI 정리

**1. 달성률 70% 미만 → Hyundai Gold**
- `PartAchievementBars` `RATE_BANDS` 70% 미만 구간 `--loss`(Active Red) → `--warn`(#A36B4F, Hyundai Gold PMS 876C). 막대·범례가 같은 정의를 써서 한 곳 수정으로 반영
- 달성률 ⓘ 설명(`infoTexts.tsx`)이 브랜드 색 개편 전 문구(`초록/보라/빨강`)로 남아 실제 색과 전부 어긋나 있던 것 발견 → `Hyundai Blue / Sky Blue / Hyundai Gold`로 갱신

**2. 라이트 모드 배경 재편** (배경=화이트, 테이블=Light Sand 요청)
- `--bg` `#F6F3F2` → `#FFFFFF`(페이지 배경), `--bg-header` `#E4DCD3` → `#F6F3F2`(Light Sand, PMS Warm Gray 1C 30%), `--bg-subtle` `#E4DCD3` → `#EDE8E4`(행 호버·칩·합계행용 중간 파생). 다크 모드는 그대로
- **부수 수정**: `var(--bg)`를 헤더/호버 배경으로 쓰던 8곳이 흰색-on-흰색이 되어 사라질 상황 — `PerformancePage`(th·행 호버·파트행 호버·파트 헤더), `KpiPage`(th·행 호버·경로 칩), `FinanceCrossCheckPanel`(th)을 `--bg-header`/`--bg-subtle`로 재지정. 이제 `var(--bg)`는 body 배경 한 곳만 사용

**3. 파트별 이익율/이익액 datalabel 통일**
- 두 모드의 색·폰트 지정은 원래 동일했고(`labelColor`), 실제 원인은 **위치**였음 — `align:'top'` 고정이라 마이너스 막대에서 라벨이 막대 위에 얹혀 진한 파란 글씨가 빨간 막대에 묻힘
- 공용 `PROFIT_LABEL` 상수로 두 모드 스타일을 한 곳에 모으고, 부호에 따라 align을 뒤집어(플러스=막대 위 / 마이너스=막대 아래) 항상 카드 배경 위에 찍히게 함. 잘림 방지 하단 padding 24px 추가

**4. 프로젝트 병합 키 — 이름 오타로 한 프로젝트가 두 묶음으로 쪼개지던 문제**
- 증상: `H093600126020002` 매출행/원가행이 병합 안 됨 → 원본 엑셀에서 프로젝트명이 다르게 입력됨(`…홍보 자료 개발` vs `…안내 자료 개발`)
- 병합 키가 `project_code + project_name`이라 다른 프로젝트로 판정. 이름을 뺄 수 없는 이유는 `생성예정`/`드롭`/`미생성` placeholder 코드 공유 문제 + **정식 코드를 공유하는 서로 다른 프로젝트 4건**(`E078600126010001` 등) 실재
- 해결: 정식 코드(`^[A-Za-z]\d{10,}$`)는 코드만으로, placeholder는 기존대로 코드+이름으로 묶는 하이브리드. 정식 코드 중복 4건은 시트에서 멀리 떨어져 있고 묶음은 연속 행끼리만 생기므로 안전. `performance.py` `_group_no` + `PerformancePage.tsx` `perfGroupKey` 양쪽 동일 규칙(어긋나면 병합 묶음과 NO.가 따로 놈)
- 실데이터 592행 시뮬레이션 검증: 묶음 299 → 298(딱 1건만 병합), 3행 이상 과병합 0건
- 남은 일: 병합 후 화면엔 매출행 이름만 보이므로 **원본 엑셀 프로젝트명 오타 정리 필요**

**5. 원가구성 도넛에 관리비 추가**
- 도넛이 직접원가·인건비·공통원가 3개만 그리고 있었는데, 실측하니 **관리비가 전체 원가의 12.0%** — 그만큼이 차트에서 빠져 있었음 (ⓘ 설명은 이미 관리비 열을 항목으로 안내하고 있어 설명과 그림이 불일치)
- 백엔드 `_build_summary` `total.cost_mgmt`는 이미 있어서 프론트만 수정 — `usePerformanceChartViewModel` costBreakdown 라벨/값 4개로, `PerformanceChartSection` doughnutColors 4번째 추가
- 4번째 색은 **Hyundai Gold**(`costMgmt` 팔레트 신규) — 기존 3톤이 전부 파랑(Hyundai/Active/Sky)이라 브랜드 9색 안에서 구분되는 유일한 선택. 직접원가가 Gold였던 시절 "갈색이 안 예쁘다"던 것과 달리 관리비는 작은 조각이라 액센트로 동작
- `chartColors.ts` 주석의 `costOverhead — 관리비` 오기도 `공통원가`로 정정

**6. 글씨 많은 컬럼 기본 폭 확대** (실적현황 프로젝트 상세)
- 실데이터 592행의 텍스트 길이를 한글 2·영숫자 1로 가중해 실측한 뒤 p50~p90 기준으로 재조정 — 프로젝트명 200 → **320**(p50이 ≈345px였음), 변동 검토의견 200 → 240, 원가율 사유 110 → 200, 사유 110 → 180, 중복점검 88 → 200, 참조코드 110 → 220, 원본파일명 size 미지정 → 300, 팀 100 → 172, 미래기술분류 108 → 148, 고객구분·교육형태·파트·사업구분·사업유형·예산코드 88~100 → 116~136
- 최댓값(프로젝트명 ≈700px)에 맞추면 테이블이 감당 못 해 p50~p90으로 절충 — 넘치는 값은 셀 팝업·리사이즈 핸들 더블클릭(auto-fit)으로 확인
- **`DataTable`에 `sizeVersion` prop 신규**: 컬럼 폭이 `localStorage`(`col-sizes-<storageKey>`)에 저장돼 있어 기본값을 바꿔도 화면에 반영되지 않던 문제 — 저장 키에 버전을 붙여 **폭만** 1회 무효화하고 컬럼 순서(`dnd-cols-…` 별도 키)는 유지. 실적현황 테이블에 `sizeVersion={2}` 적용

**7. 원가구성 범례 2열 그리드로 재작업**
- Chart.js 기본 범례가 항목을 한 줄로 흘려보내서 4개가 되자 폭에 따라 3+1로 어긋나 보임 → 기본 범례 끄고(`legend.display:false`) 도넛 아래에 HTML 범례를 직접 그림 (`DoughnutChart.module.css` 신규, 2열 그리드 · 색 점 + 이름 + 구성비, `tabular-nums`로 % 자리 정렬, 480px 이하 1열)
- 텍스트 색을 `--text-sub`/`--text-primary` 토큰으로 처리하게 되면서 `labelColor` prop이 필요 없어져 제거 (재무·실적 두 호출부 함께 정리)

**8. 프로젝트 상세 안내 문구 정정**
- "행의 아무 셀이나 더블클릭하면 …"이 사실과 달랐음 — 20자 넘는 셀은 첫 클릭에 전체 내용 팝업(전체화면 오버레이)이 떠서 두 번째 클릭을 오버레이가 먹기 때문에 프로젝트명·비고 같은 긴 셀은 펼쳐지지 않음
- 문구를 "프로젝트코드·담당자처럼 짧은 셀을 더블클릭하면 …(긴 셀은 클릭 시 전체 내용 팝업)"으로 수정. 동작 자체는 그대로 둠

**9. 차트 글씨 번짐 — 로드되지 않은 폰트가 원인**
- `Chart.defaults.font.family`와 datalabels 폰트가 `GmarketSans`/`Pretendard`를 지정했는데 둘 다 `@font-face` 선언도 `public/fonts` 파일도 없어 시스템 sans-serif(맑은 고딕)로 폴백 → `weight:'bold'`와 겹쳐 캔버스 글씨가 번져 보임. body와 같은 **HyundaiSans**로 통일(700 실제 파일 존재 → 가짜 볼드 없음). 커밋 `98a3d19`

**10. 차트 확대 모달** (`ChartCard`)
- 제목줄 우측 `⤢` 버튼 → 모달로 크게 보기. ESC·오버레이 클릭·× 로 닫기, 열린 동안 배경 스크롤 잠금, 최대 1280×820(작으면 94vw×88vh)
- 카드의 title/body 요소를 그대로 재사용해 토글·ⓘ가 모달 안에서도 동일 동작. `expandable={false}`로 개별 해제 가능. 테스트 2개 추가(59 → 61)

**11. 실적현황 KPI 카드 순서 / 계획 vs 추정 실적**
- 카드 순서: 계획 → 경상손익(당해년도 추정) → 누계 실적 → 추정 실적 (담당자 지정)
- 파트별 계획 vs 실적의 파란 막대를 `jun_actual`(1~N월 누계) → `jun_check_total`(연간 추정)로 교체. 계획이 연간 기준이라 같은 기간끼리 비교되도록 하고 제목·범례·ⓘ 설명도 "추정 실적"으로 정정

**12. KPI 목표 막대 회색 + 팔레트 `plan` 신설**
- `26년 목표`가 Hyundai Gold라 원가 계열과 같은 색이었음 → 중립 회색으로. 실적현황 "계획" 막대가 쓰던 값과 동일해 `chartColors.ts`에 `plan` 항목을 만들고 양쪽이 함께 참조하도록 통합

**13. KPI 매출액 지표가 평균으로 집계되던 버그** (`kpi.py`)
- `agg = "sum" if "건수" in name else "avg"` — 이름에 "건수"가 없는 `정부지원 사업 및 신사업 확대 (매출액, 단위 : 억)`이 평균으로 떨어졌음. 추출 스크립트 `update_summary_sheet()`는 같은 항목을 `calc_sum`으로 계산해서 **엑셀 집계 시트와 대시보드 값이 서로 달랐음**
- `_SUM_KEYWORDS = ("건수", "매출액", "금액")`로 교체. 실측 검증: 목표 45개 값 → 257.2억(평균 5.72), 실적 9개 값 → 3.4억(평균 0.38)로 엑셀 집계 시트 값과 일치. 달성률도 `합계÷합계`로 정상화(1.3%)

**14. KPI 추출 — PPT 값이 바뀌면 옛 행이 남던 문제** (`extract_kpi_ppt.py`)
- 증상: PPT에서 프로젝트코드를 고쳤는데(`H095600126040001` → `H095600126050002`) 대시보드에 옛 코드가 계속 보임. NAS에서 파일을 지우고 다시 받아 재추출해도 동일
- 원인: 행 식별 키가 (코드/연도/단계)라 코드가 바뀌면 **새 행이 추가**되고, 기존 `cleanup_deleted_files()`는 "파일명이 소스 폴더에 없는 행"만 지우는데 파일명은 그대로라 옛 행이 살아남음
- `cleanup_stale_rows()` 추가 — 이번 실행에서 **레코드가 실제로 나온 파일**에 한해, 이번 실행이 쓰지 않은 (파일명·코드·연도·단계) 행 제거. 추출 실패/KPI 표 없음(14건)인 파일은 손대지 않아 일시적 실패로 데이터가 날아가지 않음. 드라이런 결과 정확히 1행만 제거 대상
- 함께 확인한 사실: KPI 추출은 매 실행 194개 전량 재파싱(스킵 플래그 없음), 고아 행 0건. 다만 **서로 다른 PPT 7쌍이 같은 (코드/연도/단계) 키를 공유**해 덮어쓰기 경쟁 중(경고 29건, 193건 추출 → 173행). PPT 원본 코드 오입력 정리 필요

**15. 원격 12개 커밋 머지 + 빌드 실패 수정**
- 겹친 파일 3개(`PerformanceChartSection.tsx`, `usePerformanceChartViewModel.ts`, `extract_kpi_ppt.py`) 자동 머지, 충돌 0건. `파트별 계획 vs 추정 실적` 제목은 양쪽이 동일하게 수정해 그대로 합쳐짐
- 원격 커밋의 `PerformanceInsightSection.tsx`가 `CopyText` 사용처만 주석 처리하고 import를 남겨 `npm run build` 실패(`TS6133`, `tsc --noEmit`은 통과 — 빌드 tsconfig의 `noUnusedLocals`에서만 걸림) → import 제거 + 복구 시 주의 주석

**16. KPI 집계 — 프로젝트당 보고 단계 1건만 참조** (`kpi.py`)
- 요구사항: 한 프로젝트가 제안·착수·중간·완료를 다 보고하면 **가장 진행된 단계 하나만** 목표·실적에 반영. 참조 순서 `완료 → 중간 → 착수 → 제안`(그 앞 단계는 폴백)
- 기존엔 취합 시트 전체 행을 그대로 집계 → 실측 **172행 = 116 프로젝트**, 47개 프로젝트가 2단계 이상 보고라 건수·금액이 중복 계상되고 있었음
- `_latest_stage_df()` 신설: 프로젝트키(정식코드+연도, placeholder 코드는 단계 표시를 뗀 파일명+연도)로 묶고 `_STAGE_PRIORITY` 순위로 1건만 선택. 로드 시 `_kpi_stage_df`에 캐시하고 `_aggregate_kpi_col`·`_compute_achieve_rates`가 이 뷰를 사용
- 목표도 같은 기준이어야 해서 `'kpi 집계'` 시트 목표 열 대신 **취합에서 직접 집계**(`PJ목표`)하도록 변경 — 시트 값은 단계 중복이 섞여 있어 실적과 기준이 어긋났음
- 취합 표(화면)는 전체 172행 그대로 노출 — 집계에만 적용
- 적용 전후(실측): 과정 건수 목표 90 → **62**, 특화체계 25 → **17**, AI 고객사 26 → **15**, 신사업 매출액 목표 257.2 → **132.3억**·실적 3.4 → **2.5억**, NPS 목표 59.84 → 59.93·실적 69.11 → 68.5
- ⚠️ 추출 스크립트 `update_summary_sheet()`(엑셀 `kpi 집계` 시트)는 여전히 전체 행 기준 — 시트 값과 대시보드 값이 다를 수 있음

**17. KPI 집계에 26년 목표(사업계획) 컬럼 추가**
- 값 `62 / 15 / 4.0 / 12 / 10 / 4.0 / 60.3 / 10` 고정(담당자 지정, `useKpiPageViewModel` `PLAN_TARGETS`). 엑셀 D열에도 값이 있으나 PPT 원본 오입력이 섞여 있어 고정값 노출
- 기존 `26년 목표` 헤더는 `26년 목표(프로젝트)`로 구분. `storageKey` `kpi-summary` → `kpi-summary-v2`로 올려 저장된 컬럼 순서 때문에 새 컬럼이 맨 뒤로 밀리는 것 방지

**18. 기타**
- 강사만족도 탭 — 데이터 소스 미정이라 `TabNav` TABS에서 주석 처리(한 줄). `TabId`·라우팅·페이지는 유지해 `/satisfaction` 직접 접근은 살아있음
- KPI 취합 기본 페이지 크기 30 → 20행 (`useKpiPageViewModel`, 서버 페이지네이션이라 목록/KPI 상세 두 뷰 모두 적용)
- 2depth 재무이력 헤더 프로젝트코드 → `CopyText` 적용(클릭 복사, 1depth와 동일)
- `columns.tsx` — 미래월 컬럼 기본 숨김 로직 제거분(세션 외 작업분) 함께 커밋

**schedule_table `▶ 지금 실행` 확인** (코드 변경 없음)
- GUI 버튼 → `POST :5500/job/<id>/run` → `threading.Thread(run_job)` → 크론과 **동일한 cmd**를 `subprocess.run`. CLI 불필요. `daemon.log`에 수동 실행 성공 기록 확인(16:08 시작 → 16:11 완료)
- 주의: `run_job` timeout 600초 / 데몬이 떠 있어야 함
- **이상 징후**: 카드의 `다음 실행`이 이미 지난 시각(9/8 08:30)으로 표시되고 오늘 08:30·12:30 자동 실행 로그가 없음 — 실행된 건 전부 수동. 절전 후 APScheduler가 다음 시각을 갱신 못 한 것으로 보여 데몬 재시작 권장

**다음 세션 과제**
- 백엔드(`performance.py`·`kpi.py`) 변경 반영하려면 **Flask 서버 재시작 필요** (`/api/reload`·`/api/kpi/reload`는 엑셀만 다시 읽고 코드는 안 바뀜)
- KPI 재추출 1회 실행 → `cleanup_stale_rows` 로그(`[정리] … 1행 제거`) 확인, 취합 173 → 172행
- 같은 (코드/연도/단계) 키를 공유하는 서로 다른 PPT 7건 — 원본 프로젝트코드 오입력 정리 (`E126600125030001`은 4개 프로젝트가 공유)
- ~~원가구성 도넛 제목 vs 계산 불일치~~ → **해결**(2026-09-08). 계산은 전체 합계 구성비(금액 가중) 그대로 두고, 제목을 `프로젝트 평균 원가비율` → **`프로젝트 합계 원가비율`**로 정정(재무·실적현황 2곳). 실측 차이는 직접원가 합계 67.5% vs 프로젝트 단순평균 56.7% — 되돌리지 않도록 `usePerformanceChartViewModel` costBreakdown에 근거 주석
- `perfPeriod.ts` `actualRange` 문자열이 `'BF~BL (1~7월 …)'`로 하드코딩 — 기준월(8월)과 어긋난 채 ⓘ 설명에 노출
- 실적현황 원본 엑셀 `H093600126020002` 프로젝트명 오타 정리
- scheduler_daemon 재시작 후 `다음 실행` 시각 정상화 확인
- 라이트 모드 배경 화이트 전환 후 카드 경계감(흰 카드 on 흰 배경) 육안 QA
- 재무 비고 검색 안 됨 문제 (여러 세션째 이월, 계속 보류)

---

## [2026-09-08] 브랜드 색상 재조정 + 실적현황 datalabel 복구 + 파트 계산 검증

**1. 색상 재조정** (원가구성 갈색이 "안 예쁘다"는 피드백)
- `costDirect`(원가구성 도넛 직접원가), `rate`(파트별 이익율 막대) — Hyundai Gold/Active Blue shade → **Hyundai Blue**로 통일 (`chartColors.ts`)
- `PartAchievementBars` 70~100% 구간 — `--warn`(Gold) → **Sky Blue** (신규 토큰 `index.css` `--sky-blue: #AACAE6`, 라이트/다크 공통)
- **부수 버그 발견·수정**: `DoughnutChart` datalabel이 고정 `labelColor`(다크 텍스트)를 썼는데, `costDirect`가 진한 Hyundai Blue가 되면서 직접원가 세그먼트 위에서 글씨가 안 보이게 됨 → 세그먼트 배경 밝기 기준으로 흰색/어두운색을 자동 선택하는 `arcTextColor()`로 교체

**2. 실적현황 차트 수치(datalabel) 복구**
- 이전 세션에서 `usePerformanceChartViewModel.ts`(파트별 계획vs실적, 파트별 이익율)와 `PerformanceChartSection.tsx`(이익액 토글뷰) 3곳이 `datalabels: { display: false }`로 **전역 '그래프 수치' 토글과 무관하게 하드코딩 OFF** 되어 있던 것 발견 → 원래 포맷터(`${v}억`/`${v}%`, anchor/align 포함)로 복구해 토글을 다시 따르게 함

**3. 파트별 계산 로직 문서화 + 사용자 수동검증 지원**
- 재무(`finance.py api_summary`)/실적현황(`performance.py api_perf_summary`) 파트별 집계가 정확히 어떤 엑셀 열(컬럼 인덱스/문자)을 어떻게 집계하는지 컬럼 단위로 설명
- 실적현황은 프로젝트당 매출행+원가행 2행 구조라, `avg_profit_rate`가 행별 단순평균이 아니라 **금액 가중평균**(`SUM(경상손익)/SUM(점검연간합계)×100`)임을 재확인
- 사용자가 "PM파트 매출계획 3,291,327" 오차를 직접 필터링해서 검증 — 원인은 K열(구분) 조건 없이 D열(파트)만 필터링해 매출행+원가행 V열이 합산된 것(2,252,630+1,038,697=3,291,327)으로 확인. K열="매출" 조건 추가 후 2,252,630(=대시보드 값)과 정확히 일치 검증 완료
- 손익률(BG열) 단순평균도 검증: 특정 파트 BG열 114개 값 단순평균은 +0.44%인데 대시보드 가중평균은 -0.4%로 부호까지 다름 — 가중평균 방식이 맞다는 근거로 제시

**4. `paths.py` 신설 — 데이터 경로 단일 관리**
- 재무/KPI/실적 엑셀 경로 + PPT 원본 폴더 경로를 한 곳에서 관리(.env 우선, 없으면 `data/` 자동탐색). `finance.py`/`kpi.py`/`performance.py`/추출 스크립트가 전부 여기만 참조하도록 정리

**5. 실적현황 시트 자동 최신월 대응**
- `perfPeriod.ts` `PERF_YEAR`/`PERF_MONTH`를 하드코딩 → 현재월-1로 자동 계산
- 8월 시트(`ver8.3_260901`) 컬럼맵 추가 (L열 "비딩여부" 신규 삽입으로 이후 컬럼 전체가 +1 밀림 — 시프트 공식 대신 실제 헤더 재확인 후 직접 매핑)
- `jun_actual`(당월 실적) 계산 보정: 엑셀 원본 AR열이 이름과 달리 "1~12월 전체(미래 추정 포함)" 값이라 경과월(chk_m01~해당월)만 재합산하도록 수정

**6. 파트 표시 순서/이름 통일**
- `frontend/src/utils/partOrder.ts` 신설(`sortParts`/`sortByPart`) — 차트·테이블·필터 전반에서 파트 정렬 기준 통일
- 파트 앞 원문자(①~⑦) 제거 로직을 `utils/format.ts`의 `stripPartPrefix`로 통합, 중복 정규식 제거

**7. DataTable — 프로젝트 단위 행 병합 지원**
- `mergeRowsByKey`(project_code 기준 매출+원가 2행 병합 표시) + `getRowNumber`(그룹 일련번호) + `initialColumnVisibility`(컬럼 기본 숨김) 신규 지원, 실적현황 테이블에 적용
- 실적현황 라벨 정리: "N월 실적"→"누계 실적(1~N월)", "N월 점검 연간"→"추정 실적(연간)"

**커밋**: `e88c2c5` (push 완료)

**다음 세션 과제**
- 원가구성 도넛이 이제 Hyundai Blue(직접원가)+Active Blue(인건비)+Sky Blue(관리비) 파랑 계열 3톤이 됨 — 라이트/다크 육안으로 구분감 확인 필요
- `diagnostic.py`(로컬 PPT 3개 하드코딩 진단 스크립트), `playgrounds/`(참고용 정적 목업) — 이번에도 커밋 제외, 필요 여부 정리 검토
- 재무 비고 검색 안 됨 문제 (여러 세션째 이월, 계속 보류)

---

## [2026-09-07] 현대 브랜드 9색 전면 적용 + UI 텍스트/차트/페이지네이션 정비 + dashboard_manager 재작성

**1. 현대자동차 브랜드 9색 전면 적용**
- **디자인 토큰 전면 교체** (`index.css`) — 현대 공식 9색(Hyundai Blue/Sand/Light Sand/Gold, White/Black, Active Blue/Sky Blue/Active Red)과 그 파생 톤(투명도·명도)만 사용. 초록·보라·주황 등 팔레트 밖 색조 전부 제거
  - **재무 의미색 반전**: 이익 = Active Red `#e63312`(빨강=플러스), 손실 = Hyundai Blue `#002c5f`(파랑=마이너스) — 한국 증시 관행. 트렌드 배지 up/down, InsightListCard `.profit`/`.risk`, PerformancePage `.rowLoss` 모두 반영
  - **다크 모드**: Hyundai Blue 파생 — bg `#001322`, surface `#0e2038`, text Sand `#e4dcd3`, 액센트 Active/Sky Blue. 손실색은 다크에서 Sky Blue로(딥블루가 안 보여서)
  - **신규 토큰** `--danger`/`--danger-bg`(= Active Red, 에러·위험 UI를 재무 손실색과 분리), `--accent`/`--accent-bg`(= Active Blue 파생)
  - **`--accent` 미정의 버그 수정**: 14곳(DataTable 스크롤바·정렬 화살표·리사이즈 핸들, KpiRawTable, FinanceCrossCheckPanel, PerformancePage 토글)에서 쓰는데 정의가 없어 조용히 무효였음 → 한 번에 복구
  - `--purple`(4번째 차트 시리즈·rate 계열)은 보라 제거하고 Blue↔Sky 중간 블루그레이로
- **차트 팔레트 재매핑** (`chartColors.ts`) — revenue=Hyundai Blue / cost·costDirect=Gold / profit=Active Red / rate=Active Blue shade / costLabor=Active Blue / costOverhead=Sky Blue. `rgba(...,1)` 형식 유지(fadeAlpha 정규식 의존)
- **컴포넌트 CSS 20여 개 Bootstrap 잔재 제거** — 블러플/빨강/초록/보라/앰버/슬레이트/도넛 기본색 → 전부 팔레트·토큰으로. `#fff`·`rgba(0,0,0,*)` 오버레이는 팔레트 내라 유지. Button `.danger`→`--danger`, `.success`→`--info`; DoughnutChart `DEFAULT_COLORS`; FinanceCrossCheckPanel `STAGE_COLOR`; Navbar 테마토글 글로우; PerformanceChartSection 미래월 페이드 기준선

**2. 차트 수치(datalabel) 잘림 수정**
- 원인: `ChartCard .root { overflow: hidden }` + 일부 차트에 `layout.padding` 없음 → Chart.js가 캔버스 가장자리에서 라벨을 자름
- `makeBarOptions`(`chartOptions.ts`)에 side별 최소 여백(`top:30 right:58 bottom:4 left:4`) 강제 — 차트가 자체 padding을 넘기면 큰 쪽 채택(축소 안 함). `usePerformanceChartViewModel` monthlyOptions에 `padding.top` 추가, `DoughnutChart`에 `padding:12`

**3. 정렬 화살표 안 보임 (재수정)**
- 1차(투명도·색·글리프)로 안 됨 → HyundaiSans/GmarketSans에 화살표 글리프가 없어서. `.sortIdle`/`.sortActive`에 `Segoe UI Symbol` 등 심볼 폰트 강제 + `font-size 11→15px` + opacity 0.75/1

**4. 페이지네이션 블록 방식으로 변경**
- `Pagination.tsx` — 슬라이딩 윈도우(현재 페이지 항상 가운데) → 블록 방식(1~10 고정, 11페이지 가야 11~20). 기본 `windowSize` 5→10. DataTable·KpiRawTable 공통 적용

**5. 실적현황 KPI 카드 라벨/원가 표시**
- 라벨: `매출 계획 (최초)`→`매출/원가 계획`, `{월} 실적 집계`→`매출/원가 추정 실적`, `{월} 점검 연간합계`→`매출/원가 누계 실적`, `경상손익`→`경상손익(당해년도 추정)`
- 라벨에 "원가" 넣었으니 값도 노출: `performance.py` `_build_summary` `total`에 `plan_cost`(=`cost["plan_initial"].sum()`), `jun_cost_actual`(=`cost["jun_actual"].sum()`) 추가. `PerfTotal` 타입 + `usePerformanceViewModel` 카드 `sub`에 `원가 X억원` 표기(카드3 기존 포맷과 통일)

**6. 탭 개편**
- 탭명: `재무현황`→`경영실적/재무데이터`, `KPI`→`KPI/경영현황`
- **강사만족도 탭 신규**(플레이스홀더) — `TabId` += `satisfaction`, `TabNav` TABS, `routing.ts` `/satisfaction`, `pages/Satisfaction/`(EmptyState "준비 중"), `TabLayout` keep-mount. 데이터 소스·API 미정

**7. `dashboard_manager.py` 재작성 (schedule_table 패널 "대시보드 서버" 재시작 안 되던 문제)**
- 원인: `npm run dev`의 껍데기 PID를 저장 → stop()이 진짜 vite 못 죽여 orphan이 :5188 점유 → 재시작 시 새 vite가 strictPort로 기동 실패
- `netstat`로 :5000·:5188 LISTENING PID를 직접 찾아 트리째 종료. 상태 판단은 pids.json이 아닌 **포트 실제 응답**. start 후 포트 응답까지 폴링(:5000≤25s, :5188≤40s). 실제 stop→start 사이클 검증 완료
- `jobs.json`/`scheduler_daemon.py`는 수정 불필요

- lint 0 / tsc 0 / vitest 59-59 / build 통과

**재무 데이터 0건 진단 (코드 수정 아님 — 사용자가 재추출로 처리)**
- 증상: `(협력사 KOICA) ..._제안_미수주.pptx` 가 대시보드 미수주 목록에 없음 → 실제로는 `/api/data`·`/api/summary` 가 **재무 전체 0건** 반환
- 원인: `data/재무관점 필수 데이터 추출.xlsx` 가 AIP/DRM 암호화(`EncryptedPackage`, `Workbook` 스트림 없음) 상태 + 2026-09-07 10:31 시작한 재추출이 10:36:45 파일 중간에서 크래시(`[완료]` 없음, 최종 `wb.save()` 미실행) → `finance._read_excel_via_com()` 이 빈 결과 → `_empty_df()` 캐시
- `.bak`(2026-09-04, 평문) 확인: KOICA 행 정상 존재(`project_code='0'`, `note='[미수주] : ...'`), 프론트 `useMissedBidProjects` 필터(`note.includes('[미수주]')`)와도 일치 → **데이터·로직 정상, 파일 로딩만 깨짐**
- 권장: 좀비 `POWERPNT.EXE`/`EXCEL` 정리 → `extract_financial_ppt.py` 끝까지 재실행(평문 xlsx로 덮임) → `/api/reload`. 재발 방지: 출력 xlsx를 Excel로 열지 말 것(회사 AIP 레이블 자동 적용)

**다음 세션 과제**
- 브랜드 9색 적용 후 라이트/다크 3탭 육안 QA (특히 Sky Blue 도넛 세그먼트 대비, 손실=파랑이 브랜드색과 혼동되지 않는지)
- 강사만족도 탭 데이터 파이프라인 (소스 파일·추출·API 미정)
- `dashboard_update.bat`/`dashboard_update.py`의 하드코딩 PPT 경로가 구 폴더(`기술교육실_프로젝트 보고서 수집`)로 남아있음 — `.is_dir()` 가드로 무시되고 `.env` 새 경로가 쓰이긴 하나 정리 필요
- 재무 비고 검색 안 됨 문제 (이전 세션 이월, 계속 보류)

---

## [2026-09-02] 디자인 시스템 재검토 + AdminLTE/Bootstrap5 톤 전면 적용

**배경**
- 기존 자체 디자인이 "안 예쁘다"는 문제 제기로 여러 오픈소스 대시보드 템플릿(Nuxt UI, shadcn/ui, ngx-admin, vue-element-admin, AdminLTE, Adminator)을 실제로 clone해서 소스 레벨까지 조사
- Angular/Vue 전면 전환은 기존 React 프론트 자산(DataTable 리사이즈/DnD, 재무이력 2뎁스 패널, 필터 스토어 등) 전부 폐기해야 해서 배제
- vue-element-admin은 Vue2(EOL) + 실질적 유지보수 중단(2024-10 이후 커밋 없음) 확인 후 후보 제외
- 실데이터 연동한 정적 목업 3종(`playgrounds/playground-*.html`: shadcn 톤 / ngx-admin·Eva 톤 / AdminLTE·Bootstrap5 톤)을 만들어 비교 → AdminLTE/Bootstrap5 톤으로 확정
- 최종 결정: **Bootstrap 라이브러리는 설치하지 않고**, akveo/nebular·ColorlibHQ/AdminLTE 로컬 clone에서 grep으로 뽑은 실측 색상/radius/shadow 값만 기존 CSS Modules 토큰에 반영 (React 로직·구조·API 전부 유지)

**완료된 작업**
- `index.css` 전체 색상(브랜드/이익/손실/경고/정보/보더/배경)·radius 4종·shadow 3종을 라이트/다크 모두 Bootstrap5 실측값으로 교체
- KpiCard/ChartCard/Button/DataTable/Navbar/MultiSelectDropdown/ProjectTable/KpiRawTable/PartAchievementBars 등 컴포넌트별 하드코딩 색상·radius·shadow 정리
- 부수 버그 수정: 다크모드 `--shadow-lg` 누락, `Toggle`의 `--color-loss`(미정의 변수), `MultiSelectDropdown`의 `--bg-card`/`--text-main`(미정의 변수)로 스타일 미적용되던 문제
- 차트 색상(`chartColors.ts`)이 옛 인디고 팔레트로 남아있던 것을 발견 → dataviz 스킬의 사전 검증 팔레트로 교체, `validate_palette.js`로 라이트/다크 색맹 대비·명도·채도·배경대비 실측 통과 확인 후 적용
- `DataTable`: compact 테이블(KPI 집계, 파트별 실적)이 카드 폭보다 좁거나 넓으면 첫 진입 시 비례 조정해 항상 꽉 차도록 수정 (기존엔 좁을 때만 대응 + 컬럼 총합이 카드보다 넓으면 불필요한 가로 스크롤 발생하던 문제); 안 맞물리던 전체 컬럼 "⇌ 맞춤" 버튼 삭제
- 재무이력 패널(`FinanceCrossCheckPanel`) TDZ 에러 수정(`sorted` 선언 전 참조), 보고단계 가운데정렬, 폭 900→1400px 확장
- 실적현황 테이블(`perfColumns`) 프로젝트코드/파트/팀/사업구분/고객구분 기본 폭 소폭 확대, `비고` 컬럼 기본 폭 150→280px(그동안 size 미지정으로 방치돼 있었음)
- 손실/저수익 안내 텍스트(`INFO_PROJECT_TABLE`)에 실제 색상(빨강/노랑) 입히고 줄바꿈 분리
- 세션 마무리 전 CLAUDE.md 아키텍처 규칙(레이어 의존성/컴포넌트 책임) 전수 점검 후 위반 수정:
  - `InfoButton`의 raw `<button>` → `<Button unstyled>` 교체
  - `useChartViewModel`/`usePerformanceChartViewModel`이 `labelColor`를 파라미터로 받던 것 제거,
    `useKpiPageViewModel`처럼 내부에서 `useTheme()` 직접 호출하도록 통일
  - `FinanceCrossCheckPanel`의 `useQuery`+정렬+모호성 판정 로직을 `useFinanceCrossCheckViewModel`로 분리
  - `KpiRawTable`의 `cellVal`/`isImplausibleScoreRow` 순수 함수를 `utils/kpiColumns.ts`로 이동
  - `PartAchievementBars`의 달성률 계산을 `usePerformanceViewModel`의 `PerfPartRow.achieveRateNum`으로 이전
  - `theme.store.ts`가 persist 미들웨어 대신 localStorage 직접 접근하는 이유(FOUC 스크립트 포맷 일치)를 주석으로 명확화 — 의도적 예외로 유지
  - 스켈레톤 플레이스홀더 `key={i}` 6곳은 고정 개수 배열이라 실질 위험 없어 그대로 둠
  - lint/tsc/vitest(59/59)/build 전부 통과 확인

**다음 세션 과제**
- `playgrounds/playground-*.html` 3종은 참고용 정적 목업 — 실제 커밋에는 미포함, 필요시 재참조
- 재무 비고 검색 안 됨 문제 (이전 세션 이월, 계속 보류)

---

## [2026-08-31] DataTable 대규모 개선 + 재무이력 테이블 재설계 + 미수사유 파이프라인

**완료된 작업**
- **DataTable 컬럼 리사이즈 핵심 버그 수정**: `table-layout: fixed` 누락이 원인 — storageKey 있는 테이블만 적용, 없는 테이블은 auto 유지(경상손익 등 컬럼 과도한 확장 방지)
- **DataTable ⇌ 맞춤 버튼**: 현재 페이지 셀 텍스트로 모든 컬럼 자동 맞춤(스케일업 없이 타이트하게), storageKey 테이블에만 노출
- **DataTable 더블클릭 auto-fit**: 리사이즈 핸들 더블클릭 시 해당 컬럼 컨텐츠 너비로 자동 조절
- **DataTable 컬럼 드롭다운 클리핑 수정**: wrapper `overflow: visible`, 상하단 모서리는 toolbar/scroll에서 각각 처리
- **재무이력 2뎁스(FinanceCrossCheckPanel) 전면 재설계**: 카드→테이블 전환, 수동 리사이즈+더블클릭 auto-fit+localStorage 저장, 셀 팝업·복사, th 중앙정렬, 첫 진입 여백 없이 컨테이너 채움(DEFAULT_WIDTHS 비례 스케일)
- **미수주 패널(FinanceDetailPanel)**: 카드그리드→한줄 2컬럼 레이아웃, 이익율|미수사유|파일명 같은 행
- **미수주 프로젝트 섹션**: InsightSectionView 제거→단순 sectionGroup 구조, 미수사유·비고 컬럼 분리
- **미수사유 추출 파이프라인**: `extract_financial_ppt.py`에 16열 추가, PPT 전체 슬라이드에서 "★ 미수 사유" 텍스트박스 파싱, `finance.py`/`finance.types.ts` 연동
- **[신규/미생성] placeholder 코드 버그 수정**: 대괄호 패턴 코드가 PLACEHOLDER_CODES에 없어 다른 파일 비고가 덮어씌워지는 문제 — 정규식 패턴으로 확장
- **폰트**: 작은 글씨(≤0.72rem) font-weight Bold→Medium 완화 (10개 파일), KpiCard/ChartCard Geist 폰트 주석처리
- **perfColumns 전체 size 지정**: 150px 기본값으로 과도했던 컬럼들 적정 크기로(66~200px)

**다음 세션 과제**
- 맞춤 버튼 정확도 개선 여지 있음 (셀 렌더링 요소의 실제 폭 vs 텍스트 폭 차이)
- 미수사유 추출: PPT 재실행 후 데이터 채워지는지 확인 필요 (`FORCE_REPROCESS = True` 후 실행)
- 재무 비고 검색 안 됨 문제 (이전 세션 이월, 어느 검색창인지 확인 전 보류)

---

## [2026-08-26] 대표님 보고용 UX 대규모 개선 세션

**완료된 작업**
- 모바일 반응형 전수 확인 (이번 세션 목표 #1) — 480px 이하 검색창 전폭, 페이지네이션 소형화, DataTable 빈 상태 개선
- `DataTable` 빈 상태: 결과 없을 때 테이블 자체 미렌더링 → 가로 스크롤 제거, "검색 결과 없음" 즉시 노출
- `DataTable` expandedRow 자동 스크롤: 더블클릭 시 뷰포트 밖이면 smooth 스크롤
- **실적현황 2depth 검색 신규 구현**: 검색창 하나로 실적(1depth) + 재무(2depth) 병렬 조회, 재무 결과 있으면 슬라이드인 섹션 노출. 케이스별 테스트 데이터 정리 (양쪽/실적만/재무만/둘다없음)
- **2depth 패널(FinanceCrossCheckPanel) 전면 재설계**: 단계별 컬러 카드 (좌측 액센트 보더 + 헤더 tint), 수치 3열 그리드, 비고/파일명 전체 노출, 파일명 CopyText 복사, 가로 스크롤 따라오기 (JS translateX 동기화), × 닫기 버튼 정리
- **데이터 최신화 시각 표시**: `/api/summary`, `/api/performance/summary` 에 `loaded_at` 추가, 재무/실적 ActionBar에 초기 로드 시각 즉시 노출 (기존엔 reload 클릭 후에만 보였음)
- **인사이트 warning 강조 개선**: 빨간 텍스트 → "⚠ 주의" 흰 뱃지 + 라이트모드 좌측 border 추가
- **재무현황 탭 InsightSection 제거**: 인사이트는 실적현황 탭으로 단일화 (재무 PPT 기반 코멘트 제거)
- **인사이트 조건 정리**: 실적 warning 기준 — 경상이익 < 0(손실), 달성률 < 70%(부진), 재무 warning — 이익율 < 5%(저수익)
- KPI 카드 단위 통일: 점검 연간합계 sub "억" → "억원"

**다음 세션 과제**
- 재무 비고 검색 안 됨 문제 (어느 검색창인지 확인 후 이어가기 — memory 참조)
- `hasActiveFilters` 로직 오인식 문제 (초기화 버튼 제거로 우회, 다른 곳 쓰게 되면 재검토)
- 좁은 화면(모바일) 3탭 레이아웃 전수 재확인 미완료

---

## [2026-08-13] 버그 수정 다수 + 실적현황 인사이트 신규 구현 세션

**완료된 작업**
- 테이블 높이: pageSize 고정(960px) → 실제 표시 행 수 기준 동적 계산(최소 5행) + transition으로 부드러운 리사이즈, compact 테이블은 제외
- 재무/KPI 필터 기본값: 연도=올해, 파트/보고단계=전체선택 상태로 시작 + localStorage 저장(최초 방문만 초기화, 이후 마지막 선택 유지)
- 그래프 수치(datalabels) 기본값 true로 변경
- 필터 초기화 버튼 제거 (각 그룹 "전체" 칩과 기능 중복 + 전체선택 기본값과 충돌)
- 재무 검색에 파일명(filename) 컬럼 누락 수정 + 검색어 trim + 인풋 폭 확대(220→320px)
- **버그**: pandas `str.contains()`가 검색어를 정규식으로 해석해 파일명의 `[제안]` 같은 대괄호가 있으면 검색 실패 — `regex=False`로 수정
- KPI 보고단계 "-" 버그 원인 규명: `extract_kpi_ppt.py`의 `REPORT_STAGE_KEYWORDS`에 "사전검토"/"검토" 누락 → 추가 후 재추출, 고아 행(옛 "-" 값) 3건 정리
- 보고단계 표시 순서를 검토→사업계획→사전검토→제안→착수→중간→완료로 통일 (프론트 3곳 중복 정의 + 백엔드 2곳 중복 정의를 각각 하나로 통합)
- KPI "정부지원 사업 및 신사업 확대 (신규/기존 사업 건수)" 통합 항목을 신규/기존 숫자 항목 2개로 분리 (기존엔 문자열이라 차트에 0으로만 찍힘)
- KPI 취합 — "_적절성" 지표(0~5 척도)가 10 초과면 원본 오입력 의심 행으로 빨간 배경 표시
- **버그**: 위 배경 표시(및 기존 짝수행 줄무늬)가 실제로 전혀 안 먹고 있었음 — React가 `rowSpan={1}`도 DOM에 `rowspan="1"`로 렌더링해서 `td:not([rowspan])` 선택자가 아무것도 매칭 못 함. `td:not(.spanCell)`로 교체해 해결
- **실적 현황 탭 인사이트 섹션 신규 구현** (여러 세션 이월 과제) — `/api/performance/insights` 백엔드 + 목표 대비 부진/손실·저수익 랭킹 + 코멘트, 재무 인사이트와 동일 UI 재사용
- `vite.config.ts` 프록시 포트 하드코딩 제거, `BACKEND_PORT` 환경변수로 변경 (여러 세션 이월 과제)
- 3탭 라이트/다크 모드 전수 확인 (Finance/KPI/Performance) — 위 두 버그 발견은 이 과정에서 나옴

**다음 세션 과제**
- 좁은 화면(모바일) 폭 3탭 전수 재확인은 이번엔 생략 — 이전 세션에서 드롭다운 전환은 검증됨, 나머지 레이아웃은 미확인
- `hasActiveFilters` 로직이 "전체 선택 = 활성 필터"로 오인식하는 문제는 초기화 버튼 제거로 우회했지만, 다른 곳에서 이 값을 쓰게 되면 다시 손볼 것

---

## [2026-08-13] 필터 UI 되돌리기 + 차트 개편 + UX 개선 세션

**완료된 작업**
- 필터 UI: 드롭다운(`MultiSelectDropdown`) → 칩(체크박스) 방식으로 되돌림, 파트/보고단계 카테고리별 박스 시각 구분
- 파트/보고단계에 "전체" 칩 추가 — select-all-then-exclude UX (전체 클릭 시 전부 선택 → 원하는 것만 해제)
- 좁은 화면(1100px 이하) 대응 — 재무/KPI/실적현황 3탭 모두 칩 그룹 대신 드롭다운으로 자동 전환
- 테이블 검색어 매치 텍스트 하이라이트 (`HighlightText` 공용 컴포넌트 + TanStack table meta)
- "보고단계별 매출 현황" → "보고단계별 매출/지출 현황" — 필터 무관 전체 데이터 기준으로 변경, 원가구성과 위치 교체
- 원가구성 배지 — 개별 보고단계 전부 체크 시에도 "전체"로 표시 (전체 칩 직접 클릭과 동일하게 판정)
- 재무 차트 4개 드래그앤드롭 순서 변경 (그립 아이콘 핸들, localStorage 저장)
- 파트별이익율 카드에 이익율(%)/이익액(억원) 토글 추가, 이익액 토글 시 빨간색 막대 고정
- 파트별 매출/지출, 보고단계별 매출/지출 차트에 지출 시리즈 추가 (기존 이익 시리즈에서 교체)
- 월별 실적 현황 차트에 원가 시리즈 추가 + 현재 월 이후 데이터 흐리게 표시
- 이익율 상위/저수익·손실 인사이트 목록 10건까지 고정 표시 (필터-후-랭킹 순서 문제 수정)
- 추출 스크립트(`extract_financial_ppt.py`, `extract_kpi_ppt.py`) PPT 원본 폴더 경로를 `.env`로 관리 (`load_dotenv()` 누락 버그도 함께 수정)
- QueryClient/staleTime·gcTime 상수 중앙화, API 페이지네이션/필터 파라미터 조립 로직 공용화
- 코드 리뷰 기반 프론트엔드 버그 수정 + 데드 코드 정리

**다음 세션 과제**
- 실적 현황 탭 인사이트 섹션 미구현
- vite.config.ts 프록시 포트 환경변수화
- 인사이트 목록(이익율 상위/저수익) 보고단계·연도 구분 배지 — 제안만 하고 미승인 상태

---

## [2026-08-10] 매뉴얼맵 및 운영 규칙 HTML 생성 자동화

**완료된 작업**
- `scripts/make_manual_map.py`: NAS 매뉴얼 폴더 스캔 → 매뉴얼맵 HTML 생성 스크립트
  - 5개 대분류, 깊이 9까지, history 포함, 4단계 폴더 계층 구조
  - 파일 다운로드 링크 (UNC 경로), 검색·전체열기·접기 기능
  - 운영 규칙 4개 항목, 대분류별 설명글 포함
  - 빈 대분류 표시 / 제외 목록(`EXCLUDE_CATS`) 관리
- `scripts/scan_manual_folder.ps1`: Y: 드라이브 폴더 스캔 → manual_tree.csv 생성
- `scripts/update_manual_map.bat`: 스캔 + HTML 재생성 일괄 실행 배치
- Windows 작업 스케줄러 등록: 월~금 08:00, 14:00 자동 업데이트
- HTML 저장 경로: `\\10.206.32.3\기술교육팀\...\2. 매뉴얼\매뉴얼맵 및 운영 규칙.html`

**다음 세션 과제**
- 실적 현황 탭 인사이트 섹션 미구현
- vite.config.ts 프록시 포트 환경변수화

---

## [2026-08-05] 데이터 추출 재실행 + 필터 완화 + 파일 비교

**완료된 작업**
- 재무 데이터 재추출 (143개 PPT → 131행 → API 127건)
- KPI 데이터 재추출 (143개 PPT → 138행 → API 35건)
- Flask 서버 재시작 및 `/api/reload`, `/api/kpi/reload` 적용
- `app.py` `_is_valid_code` 필터 완화 — 빈 코드/"0"만 제외, 숫자코드·예정/미정/신규 허용 (99건 → 127건)
- `DataTable` DndContext를 `<thead>` 밖으로 이동 — DOM 중첩 오류 수정
- `file_compare.py` 경로 업데이트 — NAS(`X:`), 로컬(`D:\24...`), 결과(`data/compare_report.xlsx`)
- NAS vs 로컬 PPT 파일 비교 실행 → 143개 파일 완전 동일 확인

**다음 세션 과제**
- KPI AI교육 적절성 사업계획 PPT 원본 오입력 직접 수정 필요 (추출 스크립트 문제 아님)
- 실적 현황 탭 인사이트 섹션 미구현
- vite.config.ts 프록시 포트 환경변수화

---

## [2026-08-04] 추출 스크립트 증분 업데이트 + 에러 분석

**분석한 에러 (11234.png)**
1. **KPI AI교육 적절성 사업계획 이상값** — PPT 원본 오입력 문제 (코드 버그 아님). D7=3869.06은 '26년 목표(사업계획) 셀에 적절성 점수 대신 인원수가 입력된 결과
2. **재무 Excel 135건 vs API 108건** — 프로젝트코드 없음/매출 0 행 27건 Flask 자동 필터링 (정상 동작)
3. **재무 파트명 '-' 인식 실패** — 파일명에 키워드 없는 파일들 → 폴더명 기반 추출로 해결

**완료된 작업**
- `extract_financial_ppt.py`: `RESET_OUTPUT_ON_START=False`, `FORCE_REPROCESS=False` — 기존 데이터 보존, 증분 업데이트 전환
- `extract_kpi_ppt.py`: ROOT_DIR 기본값 오타 수정 (`수집 NEW` → `수집`)
- 두 스크립트: `FOLDER_PART_MAP` 추가 — 폴더명으로 파트명 우선 판단
  - `AI교육파트`→AI, `SW교육파트`→SW, `교육사업PM파트`→PM
  - `신사업기획파트`→신사업, `미래모빌리티교육파트`→미모
  - `전동화&차량개발교육파트`→전차, `K뉴딜 아카데미 TF`→K뉴딜TF
- 두 스크립트: CLI 인수 지원 — `python script.py "C:\새폴더"` 로 새 배치 폴더 처리 가능

**다음 세션 과제**
- KPI AI교육 적절성 사업계획 PPT 원본 오입력 직접 수정 필요 (추출 스크립트 문제 아님)
- 재무 데이터 새 폴더 기준 재추출 실행 (스크립트 실행)
- 실적 현황 탭 인사이트 섹션 미구현
- vite.config.ts 프록시 포트 환경변수화

---

## [2026-08-03] UI 개선 및 버그 수정 세션 (오후)

**완료된 작업**
- 컬럼 드롭박스 외부 클릭 시 자동 닫힘 (useRef + mousedown)
- 다크모드 배경/텍스트 밝기 개선 (surface #182E48, text #F0F8FF)
- 다크모드 탭 리모컨 글씨 색상 수정 (rgba(180,230,255,0.85))
- 다크모드 차트 에메랄드 계열 색상 적용 (rgba(52,211,153))
- KPI 집계 D열(사업계획) update_summary_sheet 추가
- KPI 취합 검색 시 page 1 리셋 누락 버그 수정
- PPT 파일 비교 분석 (기술교육실_프로젝트 보고서 수집 vs Excel 확인본)
- 데이터 검증: KPI AI적절성 사업계획 이상값(14157) 확인 → PPT 원본 데이터 문제
- README 실행 방법 명확화 (서버 vs 추출 스크립트 구분)
- 차트 글로우 효과 시도 후 가독성 문제로 비활성화

**다음 세션 과제**
- KPI AI교육 적절성 사업계획 PPT 원본 데이터 오입력 확인 및 수정
- 재무 데이터 새 폴더 기준 재추출 필요 (extract_financial_ppt.py)
- 실적 현황 탭 인사이트 섹션 미구현
- vite.config.ts 프록시 포트 환경변수화

---

## [2026-08-03] 대규모 개선 세션

**목표**: KPI 상세 뷰 구현, URL 탭 유지, 컬럼 DnD/리사이즈, 코드 리뷰 수정

**완료된 작업**

### 백엔드 (app.py)
- KPI 사업계획 컬럼 추출: extract_kpi_ppt.py에 PPT col 4('26년 목표 사업계획) 파싱 추가
- kpi 집계 시트 D열 사업계획 집계 추가, 헤더 구분 명확화 (`'26년 목표(사업계획)` / `'26년 목표(프로젝트)`)
- 신규/기존 건수 행: 26년 실적·25년 유사실적도 `신규:N건/기존:N건` 형식으로 반환
- KPI 프로젝트코드 필터 regex: `str.match` → `str.fullmatch` ($ 앵커 누락 수정)
- 차트 actual_2026 type 가드: 문자열 값이 Chart.js에 NaN으로 전달되던 문제 수정
- AIP 암호화 Excel/PPT win32com 자동 우회 처리 (기존 세션에서 이미 구현)

### 프론트엔드
- **React Router(HashRouter) 도입**: 탭 URL 연동 (`/#/finance·kpi·performance`), 새로고침 후 탭 유지
- **TabRemote(사이드 리모컨)**: 화면 오른쪽 고정, 스크롤 없이 탭 전환
- **DataTable 컬럼 DnD + 리사이즈**: localStorage 저장, 새로고침 유지. DraggableTh 모듈 스코프 이동(hooks 규칙 준수)
- **KpiRawTable(rowspan 뷰)**: 프로젝트 1개 = KPI 8행, PPT 표 형태 재현. 컬럼 DnD + 리사이즈 지원
- **KPI 취합 뷰 토글**: 목록(플랫) ↔ KPI 상세(rowspan) 툴바 내 전환
- **KPI 집계 테이블**: 검색·정렬 활성화 (hideToolbar 제거)
- **KPI 집계 KPI 상세 뷰**: 툴바에 toolbarExtra prop으로 통합
- 테이블 고정 높이 560px: 마지막 페이지 데이터 적어도 크기 유지
- 테이블 하단 border 추가: 가로스크롤 없어도 하단 선 표시
- 비고 컬럼 → '노트' 텍스트 변경, filename 기본 숨김 복구
- KpiRawTable raw `<button>` → `<Button>` 컴포넌트 교체 (CLAUDE.md 준수)

### 문서
- README 전면 개정: 재무·KPI·실적 계산 방식, 신규 기능 사용법, 데이터 파이프라인

**다음 세션 과제**
- KPI 집계 시트 D열(사업계획) 추출 스크립트 재실행 필요 (서버 재시작 + extract_kpi_ppt.py 실행)
- 실적 현황 탭 인사이트 섹션 미구현 (목표 대비 부진 파트, 손실 경고)
- vite.config.ts 프록시 포트 환경변수화

---

## [2026-07-30] 3탭 대시보드 구축 세션

**목표**: 재무·KPI·실적 현황 3탭 구조 + 공통 컴포넌트 아키텍처 정비

**완료된 작업**

### 백엔드 (app.py)
- 엑셀 컬럼 구조 수정: 13컬럼 → 15컬럼(year·part 포함), `EXCEL_PATH` 로컬 경로 수정
- 실적 API 추가: `/api/performance/*` (data, summary, options, reload) — 사업계획 통합관리 파일 연동
- KPI API 추가: `/api/kpi/*` (data, summary, reload) — KPI 지표 추출 파일 연동
- KPI 집계 로직: 취합 시트 기준 건수→합계/나머지→평균 계산
- NaN JSON 직렬화 수정 (브라우저 파싱 오류 해결)
- 월별 실적 집계: chk_m01~m12 합계 → `/api/performance/summary`에 monthly 추가

### 프론트엔드
- 3탭 네비게이션: `tab.store.ts` + `TabNav` + `TabLayout` (sticky)
- `PerformanceFilterBar` — FilterBar와 동일 레벨로 sticky 고정
- 공통 `DataTable` (TanStack Table 기반): 세로 컬럼 선, 정렬·검색·페이지네이션, 컬럼 숨김, 합계 행, 스켈레톤, 셀 클릭 팝업
- `FinancePage` 분리 (`pages/Finance/`) — App 구조 정비
- `PerformancePage`: 월별 바 차트 + 파트별 실적(compact DataTable) + 프로젝트 상세
- `KpiPage`: 목표 vs 실적 가로 바 차트 + KPI 집계 카드 리스트 + 취합 DataTable
- `PERF_HIDEABLE_COLS` + `perfColumns` 동일 파일(`PerformanceTable/columns.tsx`) 관리
- `utils/format.ts`에 `formatEok`, `formatPctRaw`, `formatNum` 추가
- 프로젝트코드 첫 번째 컬럼 이동 + CopyText 적용
- `DataTable` compact 모드 추가 (파트별 실적 등 고정 소규모 테이블)

**다음 세션 과제**
- `extract_kpi_ppt.py` ROOT_DIR 경로 수정 (PPT 파일 0개 검색 문제)
- `vite.config.ts` 프록시 포트 하드코딩 → 환경변수로 개선
- 파이썬 추출 로직 수정 (PPT → 엑셀 파이프라인 안정화)

---

## [2026-07-20] pandas 도입 + PDF 내보내기 세션

**목표**: 백엔드 리팩토링 + PDF 보고서 기능 추가

**완료된 작업**
- `app.py` pandas 전면 도입: `load_excel` → `pd.read_excel`, 집계 루프 → `groupby/agg/nlargest`
- `profit_rate` 이중 파싱 문제 해결 (known-issues 해소)
- `GET /api/export/pdf` 엔드포인트 추가: 필터 연동, 한글 폰트(맑은고딕), 요약·파트별·TOP5·리스크 섹션
- 대시보드 UI에 PDF 버튼 추가 (필터 상태 유지하여 다운로드)
- `requirements.txt`에 pandas, reportlab 추가

**다음 세션 과제**
- TypeScript 아키텍처 설계 (사용자 주도)
- GitHub MCP 연결 확인 (재시작 후)

---

## [2026-07-20] 초기 구축 세션

**목표**: 재무 대시보드 Flask 앱 초기 구축 + GitHub 업로드 + Claude 자동화 설정

**완료된 작업**
- Flask 앱(`app.py`) 구현: 엑셀 로드, 필터링, 집계, 인사이트 API
- `index.html` 대시보드 UI (연도·파트·보고단계 필터, 차트, 인사이트 카드)
- `style.css` 커스텀 스타일
- Git 초기화 및 GitHub push (`https://github.com/ghtjd1358/Finance-Dashboard.git`)
- CLAUDE.md, `docs/` 문서, `settings.json` 훅, `/deploy` 스킬 구성

**다음 세션 과제**
- EXCEL_PATH 환경 이식성 개선 (다른 PC에서 사용 시 경로 수정 안내 문구 추가 검토)
- 데이터 자동 갱신 주기 검토
- 배포 환경 구성 검토
