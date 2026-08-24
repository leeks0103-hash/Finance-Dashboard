import type { ChartOptions, ChartEvent, LegendItem, LegendElement } from 'chart.js';

/** 범례 라디오 클릭 — 클릭한 시리즈만 단독 표시, 다시 클릭하면 전체 복원 */
const legendRadioClick = (_e: ChartEvent, legendItem: LegendItem, legend: LegendElement<'bar'>) => {
  const chart = legend.chart;
  const idx   = legendItem.datasetIndex ?? 0;
  const metas = chart.data.datasets.map((_, i) => chart.getDatasetMeta(i));
  const onlyMeVisible = metas.every((m, i) => (i === idx ? !m.hidden : m.hidden));
  metas.forEach((m, i) => { m.hidden = onlyMeVisible ? false : i !== idx; });
  chart.update();
};

/** 그래프 수치(datalabels) 토글 반영 바 차트 옵션 빌더 — 재무/KPI/실적현황 차트 공용 */
export const makeBarOptions = (
  display: boolean,
  labelColor: string,
  extra?: Partial<ChartOptions<'bar'>>,
): ChartOptions<'bar'> => ({
  animation: { duration: 700, easing: 'easeInOutQuart' },
  layout: extra?.layout,
  plugins: {
    legend: { onClick: legendRadioClick, ...(extra?.plugins?.legend ?? {}) },
    datalabels: {
      display,
      color:  labelColor,
      font:   { size: 12, weight: 'bold' },
      anchor: 'center',
      align:  'center',
      ...(extra?.plugins?.datalabels ?? {}),
    },
  },
  scales: extra?.scales,
} as ChartOptions<'bar'>);
