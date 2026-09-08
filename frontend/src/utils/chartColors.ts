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
 *   costOverhead — 원가구성 도넛: 공통원가 (Sky Blue)
 *   costMgmt     — 원가구성 도넛: 관리비 (Hyundai Gold — 파랑 3톤과 구분되는 유일한 브랜드색)
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
}

/** 데이터 시리즈 색과 별개로, 축 눈금·격자선·데이터라벨 텍스트에 쓰는 차트 "크롬" 색 — 3탭 공용 */
export interface ChartTheme {
  labelColor: string;
  gridColor:  string;
  tickColor:  string;
}

export const getChartTheme = (dark: boolean): ChartTheme => dark ? {
  labelColor: 'rgba(228,220,211,0.95)',  /* Hyundai Sand */
  gridColor:  'rgba(60,90,120,0.45)',    /* Blue-tinted grid */
  tickColor:  'rgba(228,220,211,0.90)',  /* Hyundai Sand */
} : {
  labelColor: '#002C5F',                 /* Hyundai Blue */
  gridColor:  'rgba(0,44,95,0.08)',      /* Hyundai Blue 연하게 */
  tickColor:  '#002C5F',                 /* Hyundai Blue */
};

// fadeAlpha(PerformanceChartSection)가 마지막 숫자를 정규식으로 치환하는 방식이라
// rgba(...) 형식(알파 1) 유지 — 순수 hex로 바꾸면 미래월 페이드 효과가 조용히 깨짐
//
// 현대자동차 브랜드 9색 기반 (증시 반대 개념 — 플러스=파랑, 마이너스=빨강):
//   revenue/profit/rate/costDirect = Hyundai Blue · loss = Active Red · cost = Hyundai Gold
//   costLabor = Active Blue · costOverhead = Sky Blue · costMgmt = Hyundai Gold
export const getChartPalette = (dark: boolean): ChartPalette => dark ? {
  revenue:      'rgba(77,166,214,1)',   /* Hyundai Blue tint — 다크 가독성 */
  cost:         'rgba(199,148,113,1)',  /* Hyundai Gold tint */
  profit:       'rgba(77,166,214,1)',   /* Hyundai Blue tint — 플러스 */
  loss:         'rgba(255,106,77,1)',   /* Active Red tint — 마이너스 */
  rate:         'rgba(77,166,214,1)',   /* Hyundai Blue tint — profit과 동일 */
  costDirect:   'rgba(77,166,214,1)',   /* Hyundai Blue tint — 갈색(Gold) 폐기 */
  costLabor:    'rgba(0,170,210,1)',    /* Active Blue */
  costOverhead: 'rgba(170,202,230,1)',  /* Sky Blue */
  costMgmt:     'rgba(199,148,113,1)',  /* Hyundai Gold tint */
} : {
  revenue:      'rgba(0,44,95,1)',      /* Hyundai Blue */
  cost:         'rgba(163,107,79,1)',   /* Hyundai Gold */
  profit:       'rgba(0,44,95,1)',      /* Hyundai Blue — 플러스 */
  loss:         'rgba(230,51,18,1)',    /* Active Red — 마이너스 */
  rate:         'rgba(0,44,95,1)',      /* Hyundai Blue — profit과 동일 */
  costDirect:   'rgba(0,44,95,1)',      /* Hyundai Blue — 갈색(Gold) 폐기 */
  costLabor:    'rgba(0,170,210,1)',    /* Active Blue */
  costOverhead: 'rgba(170,202,230,1)',  /* Sky Blue */
  costMgmt:     'rgba(163,107,79,1)',   /* Hyundai Gold */
};
