import type { ChartOptions } from 'chart.js';

/** 그래프 수치(datalabels) 토글 반영 바 차트 옵션 빌더 — 재무/KPI/실적현황 차트 공용 */
export const makeBarOptions = (
  display: boolean,
  labelColor: string,
  extra?: Partial<ChartOptions<'bar'>>,
): ChartOptions<'bar'> => ({
  animation: { duration: 700, easing: 'easeInOutQuart' },
  layout: extra?.layout,
  plugins: {
    datalabels: {
      display,
      color:  labelColor,
      font:   { size: 12, weight: 'bold' },
      ...((extra?.plugins as any)?.datalabels ?? {}),
    },
  },
  scales: extra?.scales,
} as ChartOptions<'bar'>);
