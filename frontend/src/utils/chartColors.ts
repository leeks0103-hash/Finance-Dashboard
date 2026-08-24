/**
 * 재무·KPI·실적현황 3탭 전체가 공유하는 차트 색상 팔레트.
 * 지표별 의미를 색으로 고정해 탭을 넘나들어도 같은 지표는 같은 색으로 보이게 한다.
 *   revenue/actual — 매출·실적 (브랜드 인디고)
 *   cost           — 지출·원가·손실 (레드)
 *   profit         — 이익 절대금액 (그린)
 *   rate           — 이익율(%) 등 비율 지표 — KpiCard "평균 이익율" 배지와 동일 계열(퍼플)
 *   costDirect/costLabor/costOverhead — 원가구성 도넛 3분할 — 톤 변주 대신 레드/앰버/틸로 확실히 구분
 */
export interface ChartPalette {
  revenue:      string;
  cost:         string;
  profit:       string;
  rate:         string;
  costDirect:   string;
  costLabor:    string;
  costOverhead: string;
}

/** 데이터 시리즈 색과 별개로, 축 눈금·격자선·데이터라벨 텍스트에 쓰는 차트 "크롬" 색 — 3탭 공용 */
export interface ChartTheme {
  labelColor: string;
  gridColor:  string;
  tickColor:  string;
}

export const getChartTheme = (dark: boolean): ChartTheme => dark ? {
  labelColor: 'rgba(255,255,255,0.95)',
  gridColor:  'rgba(90,90,100,0.55)',
  tickColor:  'rgba(230,230,236,0.95)',
} : {
  labelColor: '#111111',
  gridColor:  'rgba(0,0,0,0.08)',
  tickColor:  '#1E1E1E',
};

export const getChartPalette = (dark: boolean): ChartPalette => dark ? {
  revenue:      'rgba(129,140,248,0.82)',
  cost:         'rgba(248,113,113,0.82)',
  profit:       'rgba(52,211,153,0.82)',
  rate:         'rgba(192,132,252,0.85)',
  costDirect:   'rgba(248,113,113,0.85)',
  costLabor:    'rgba(34,211,238,0.82)',
  costOverhead: 'rgba(45,212,191,0.82)',
} : {
  revenue:      'rgba(79,70,229,0.80)',
  cost:         'rgba(220,38,38,0.75)',
  profit:       'rgba(5,150,105,0.78)',
  rate:         'rgba(124,58,237,0.80)',
  costDirect:   'rgba(220,38,38,0.82)',
  costLabor:    'rgba(6,182,212,0.80)',
  costOverhead: 'rgba(13,148,136,0.80)',
};
