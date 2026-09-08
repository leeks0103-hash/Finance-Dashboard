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

// datalabels(막대 밖 수치)가 캔버스 가장자리에 잘리지 않도록 최소 확보할 여백.
// ChartCard(.root)가 overflow:hidden이라 캔버스 밖으로 넘친 라벨은 그대로 잘리므로,
// 차트별 extra.layout.padding 이 이 값보다 작으면 side별로 큰 쪽을 채택(축소는 안 함).
const MIN_CHART_PADDING = { top: 30, right: 58, bottom: 4, left: 4 };

const resolvePadding = (extra?: Partial<ChartOptions<'bar'>>) => {
  const given = extra?.layout && typeof extra.layout === 'object' ? extra.layout.padding : undefined;
  const g = typeof given === 'number'
    ? { top: given, right: given, bottom: given, left: given }
    : (given ?? {}) as Record<'top' | 'right' | 'bottom' | 'left', number | undefined>;
  return {
    top:    Math.max(MIN_CHART_PADDING.top,    g.top    ?? 0),
    right:  Math.max(MIN_CHART_PADDING.right,  g.right  ?? 0),
    bottom: Math.max(MIN_CHART_PADDING.bottom, g.bottom ?? 0),
    left:   Math.max(MIN_CHART_PADDING.left,   g.left   ?? 0),
  };
};

/** 그래프 수치(datalabels) 토글 반영 바 차트 옵션 빌더 — 재무/KPI/실적현황 차트 공용 */
export const makeBarOptions = (
  display: boolean,
  labelColor: string,
  extra?: Partial<ChartOptions<'bar'>>,
): ChartOptions<'bar'> => ({
  animation: { duration: 700, easing: 'easeInOutQuart' },
  layout: {
    ...(extra?.layout && typeof extra.layout === 'object' ? extra.layout : {}),
    padding: resolvePadding(extra),
  },
  plugins: {
    legend: { onClick: legendRadioClick, ...(extra?.plugins?.legend ?? {}) },
    datalabels: {
      display,
      color:  labelColor,
      font:   { size: 13, weight: 'bold', family: "'HyundaiSans', 'Malgun Gothic', sans-serif" },
      anchor: 'center',
      align:  'center',
      ...(extra?.plugins?.datalabels ?? {}),
    },
  },
  scales: extra?.scales,
} as ChartOptions<'bar'>);
