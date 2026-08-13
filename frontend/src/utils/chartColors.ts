/**
 * 재무·KPI·실적현황 3탭 전체가 공유하는 차트 색상 팔레트.
 * 지표별 의미를 색으로 고정해 탭을 넘나들어도 같은 지표는 같은 색으로 보이게 한다.
 *   revenue/actual — 매출·실적 (브랜드 인디고)
 *   cost           — 지출·원가·손실 (레드)
 *   profit         — 이익 절대금액 (그린)
 *   rate           — 이익율(%) 등 비율 지표 — KpiCard "평균 이익율" 배지와 동일 계열(퍼플)
 *   target         — KPI 목표·계획 (앰버)
 *   costDirect/costLabor/costOverhead — 원가구성 도넛 3분할 — 톤 변주 대신 레드/앰버/틸로 확실히 구분
 */
export interface ChartPalette {
  revenue:      string;
  cost:         string;
  profit:       string;
  rate:         string;
  target:       string;
  costDirect:   string;
  costLabor:    string;
  costOverhead: string;
}

export const getChartPalette = (dark: boolean): ChartPalette => dark ? {
  revenue:      'rgba(129,140,248,0.82)',
  cost:         'rgba(248,113,113,0.82)',
  profit:       'rgba(52,211,153,0.82)',
  rate:         'rgba(192,132,252,0.85)',
  target:       'rgba(251,191,36,0.80)',
  costDirect:   'rgba(248,113,113,0.85)',
  costLabor:    'rgba(251,191,36,0.82)',
  costOverhead: 'rgba(45,212,191,0.82)',
} : {
  revenue:      'rgba(79,70,229,0.80)',
  cost:         'rgba(220,38,38,0.75)',
  profit:       'rgba(5,150,105,0.78)',
  rate:         'rgba(124,58,237,0.80)',
  target:       'rgba(217,119,6,0.75)',
  costDirect:   'rgba(220,38,38,0.82)',
  costLabor:    'rgba(217,119,6,0.80)',
  costOverhead: 'rgba(13,148,136,0.80)',
};
