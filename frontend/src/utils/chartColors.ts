/**
 * 재무·KPI·실적현황 3탭 전체가 공유하는 차트 색상 팔레트.
 * 지표별 의미를 색으로 고정해 탭을 넘나들어도 같은 지표는 같은 색으로 보이게 한다.
 *
 * 현대자동차 브랜드 지정 9색 팔레트 기반 (Sky Blue는 도넛 세그먼트 한정, 텍스트엔 미사용).
 * 브랜드 지정값이라 대비 검증보다 팔레트 준수 우선.
 *   revenue      — 매출·실적 (Hyundai Blue)
 *   cost         — 지출·원가 (Hyundai Gold)
 *   profit       — 이익 절대금액 (Hyundai Blue — 파랑=플러스, 증시 반대 개념)
 *   loss         — 손실·마이너스 (Active Red — 빨강=마이너스)
 *   rate         — 이익율(%) 등 비율 지표 (Hyundai Blue — profit과 동일 계열)
 *   costDirect   — 원가구성 도넛: 직접원가 (Hyundai Blue — cost/Gold와 분리, 갈색 계열 폐기)
 *   costLabor    — 원가구성 도넛: 인건비 (Active Blue)
 *   costOverhead — 원가구성 도넛: 공통원가 (Sky Blue에 검정 30% 섞은 톤 — 원색은 너무 연해서)
 *   costMgmt     — 원가구성 도넛: 관리비 (Hyundai Gold — 파랑 3톤과 구분되는 유일한 브랜드색)
 *   plan         — 계획·목표 등 비교 기준선 계열 (Sand/블루그레이 중립 — 실적 계열과 겹치지 않게). 계획 막대는 이 색으로 통일
 *   planLabel    — 계획 막대 위 수치 글자색 (plan을 불투명·진하게 — 반투명 plan 그대로면 글자가 흐려서, 막대색은 유지)
 *   planRevenue  — "파트별 추정 매출/원가" 확대 모달 전용 매출 계획선 (매출과 같은 파랑 계열, 밝기만 다르게)
 *   planCost     — 같은 모달 전용 원가 계획선 (원가와 같은 Gold 계열, 라이트=훨씬 진하게 / 다크=훨씬 밝게)
 *                  — 막대와 완전히 같은 색이면 계획 < 실적인 파트에서 선이 막대 안에 묻혀 안 보임.
 *                    대조 대상을 색 계열로 알아보면서 막대 위에서도 구분되게 하려는 이 차트만의 예외
 */
export interface ChartPalette {
  revenue:      string;
  cost:         string;
  profit:       string;
  loss:         string;
  rate:         string;
  costDirect:   string;
  costLabor:    string;
  costOverhead: string;
  costMgmt:     string;
  plan:         string;
  planLabel:    string;
  planRevenue:  string;
  planCost:     string;
}

/** 데이터 시리즈 색과 별개로, 축 눈금·격자선·데이터라벨 텍스트에 쓰는 차트 "크롬" 색 — 3탭 공용 */
export interface ChartTheme {
  labelColor: string;
  gridColor:  string;
  tickColor:  string;
  /** 카드 배경(--surface)과 같은 색 — 수치 라벨 뒤에 깔아 선·막대가 글자를 관통하지 않게 가릴 때 */
  surfaceColor: string;
}

export const getChartTheme = (dark: boolean): ChartTheme => dark ? {
  labelColor: 'rgba(228,220,211,0.95)',  /* Hyundai Sand */
  gridColor:  'rgba(60,90,120,0.45)',    /* Blue-tinted grid */
  tickColor:  'rgba(228,220,211,0.90)',  /* Hyundai Sand */
  surfaceColor: '#0E2038',               /* index.css 다크 --surface */
} : {
  labelColor: '#002C5F',                 /* Hyundai Blue */
  gridColor:  'rgba(0,44,95,0.08)',      /* Hyundai Blue 연하게 */
  tickColor:  '#002C5F',                 /* Hyundai Blue */
  surfaceColor: '#FFFFFF',               /* index.css 라이트 --surface */
};

// fadeAlpha(PerformanceChartSection)가 마지막 숫자를 정규식으로 치환하는 방식이라
// rgba(...) 형식(알파 1) 유지 — 순수 hex로 바꾸면 미래월 페이드 효과가 조용히 깨짐
//
// 현대자동차 브랜드 9색 기반 (증시 반대 개념 — 플러스=파랑, 마이너스=빨강):
//   revenue/profit/rate/costDirect = Hyundai Blue · loss = Active Red · cost = Hyundai Gold
//   costLabor = Active Blue · costOverhead = Sky Blue 어둡게 · costMgmt = Hyundai Gold
export const getChartPalette = (dark: boolean): ChartPalette => dark ? {
  revenue:      'rgba(77,166,214,1)',   /* Hyundai Blue tint — 다크 가독성 */
  cost:         'rgba(199,148,113,1)',  /* Hyundai Gold tint */
  profit:       'rgba(77,166,214,1)',   /* Hyundai Blue tint — 플러스 */
  loss:         'rgba(255,106,77,1)',   /* Active Red tint — 마이너스 */
  rate:         'rgba(77,166,214,1)',   /* Hyundai Blue tint — profit과 동일 */
  costDirect:   'rgba(77,166,214,1)',   /* Hyundai Blue tint — 갈색(Gold) 폐기 */
  costLabor:    'rgba(0,170,210,1)',    /* Active Blue */
  costOverhead: 'rgba(119,141,161,1)',  /* Sky Blue에 검정 30% — 원래 Sky Blue는 흰 배경에서 너무 연했음(2026-09-29) */
  costMgmt:     'rgba(199,148,113,1)',  /* Hyundai Gold tint */
  plan:         'rgba(159,179,196,0.55)', /* 블루그레이 중립 — 계획·목표 */
  planLabel:    'rgba(159,179,196,1)',  /* plan 불투명 — 수치 글자용 */
  planRevenue:  'rgba(170,202,230,1)',  /* Sky Blue — revenue tint보다 밝게 */
  planCost:     'rgba(245,225,205,1)',  /* Hyundai Gold 아주 밝은 파생 — cost tint(중간 밝기)와 밝기 차 크게 */
} : {
  revenue:      'rgba(0,44,95,1)',      /* Hyundai Blue */
  cost:         'rgba(163,107,79,1)',   /* Hyundai Gold */
  profit:       'rgba(0,44,95,1)',      /* Hyundai Blue — 플러스 */
  loss:         'rgba(230,51,18,1)',    /* Active Red — 마이너스 */
  rate:         'rgba(0,44,95,1)',      /* Hyundai Blue — profit과 동일 */
  costDirect:   'rgba(0,44,95,1)',      /* Hyundai Blue — 갈색(Gold) 폐기 */
  costLabor:    'rgba(0,170,210,1)',    /* Active Blue */
  costOverhead: 'rgba(119,141,161,1)',  /* Sky Blue에 검정 30% — 원래 Sky Blue는 흰 배경에서 너무 연했음(2026-09-29) */
  costMgmt:     'rgba(163,107,79,1)',   /* Hyundai Gold */
  plan:         'rgba(107,98,87,0.45)',  /* Sand 계열 중립 — 계획·목표 */
  planLabel:    'rgba(132,129,125,1)',  /* plan의 흰 배경 실효색(188,184,179)에 검정 30% — 수치 글자가 흐리다는 피드백(2026-09-29) */
  planRevenue:  'rgba(0,170,210,1)',    /* Active Blue — Hyundai Blue 막대 위에서도 보이게 */
  planCost:     'rgba(92,54,34,1)',     /* Hyundai Gold 진한 파생 — Gold 막대보다 확실히 어둡게(밝은 톤은 막대와 구분 안 됨) */
};
