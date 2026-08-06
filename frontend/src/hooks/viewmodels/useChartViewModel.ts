import { useMemo } from 'react';
import { useSummary } from '@/hooks/useSummary';
import { useUiStore } from '@/store';
import type { ChartOptions } from 'chart.js';

const makeBarOptions = (
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

export interface ChartViewModel {
  isLoading:    boolean;
  isEmpty:      boolean;
  showLabels:   boolean;
  showLogScale: boolean;
  revExp: {
    labels:   string[];
    revenues: number[];
    profits:  number[];
    options:  ChartOptions<'bar'>;
  };
  costBreakdown: {
    labels: string[];
    values: number[];
  };
  profitRate: {
    labels:   string[];
    rates:    number[];
    isProfit: boolean[];
    options:  ChartOptions<'bar'>;
  };
  yearTrend: {
    labels:   string[];
    revenues: number[];
    profits:  number[];
    rates:    number[];
    options:  ChartOptions<'bar'>;
  };
  stageChart: {
    labels:   string[];
    revenues: number[];
    counts:   number[];
    options:  ChartOptions<'bar'>;
  };
  labelColor: string;
}

export const useChartViewModel = (labelColor: string): ChartViewModel => {
  const { data, isLoading } = useSummary();
  const showLabels   = useUiStore(s => s.showChartLabels);
  const showLogScale = useUiStore(s => s.showLogScale);

  const revExpOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    layout: { padding: { right: 52 } },
    plugins: {
      datalabels: {
        anchor: 'end',
        align:  'end',
        formatter: (v: number) =>
          Math.abs(v) >= 1 ? `${v.toFixed(1)}억` : `${(v * 10).toFixed(0)}천만`,
      },
    },
  }), [showLabels, labelColor]);

  const profitRateOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    layout: { padding: { top: 24 } },
    plugins: {
      datalabels: {
        anchor: 'end',
        align:  'top',
        offset: 2,
        formatter: (v: number) => `${v}%`,
      },
    },
    scales: {
      y: {
        // 로그 스케일: 0/음수 바가 있으면 linear로 fallback (Chart.js 요구사항)
        type: 'linear' as const,
        ticks: { callback: (v: string | number) => v + '%' },
      },
    },
  }), [showLabels, labelColor]);

  const yearTrendOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    layout: { padding: { right: 52 } },
    plugins: {
      datalabels: {
        anchor: 'end',
        align:  'end',
        formatter: (v: number) =>
          Math.abs(v) >= 1 ? `${v.toFixed(1)}억` : `${(v * 10).toFixed(0)}천만`,
      },
    },
  }), [showLabels, labelColor]);

  const chartData = useMemo(() => {
    if (!data || isLoading) return null;
    const parts   = Object.keys(data.by_part);
    const cb      = data.cost_breakdown;
    const byYear  = data.by_year ?? {};
    const years   = Object.keys(byYear).sort();
    const byStage = data.by_stage ?? {};
    const stages  = Object.keys(byStage);

    return {
      isEmpty: parts.length === 0,
      revExp: {
        labels:   parts,
        revenues: parts.map(p => +(data.by_part[p].revenue / 1e8).toFixed(1)),
        profits:  parts.map(p => +(data.by_part[p].profit  / 1e8).toFixed(1)),
      },
      costBreakdown: {
        labels: ['직접원가', '직접인건비', '공통원가/관리비'],
        values: [cb.direct_cost, cb.labor_cost, cb.overhead].map(v => +(v / 1e8).toFixed(1)),
      },
      profitRate: {
        labels:   parts,
        rates:    parts.map(p => {
          const rev = data.by_part[p].revenue;
          return rev === 0 ? 0 : +(data.by_part[p].profit / rev * 100).toFixed(1);
        }),
        isProfit: parts.map(p => data.by_part[p].profit >= 0),
      },
      yearTrend: {
        labels:   years,
        revenues: years.map(y => +(byYear[y].revenue / 1e8).toFixed(1)),
        profits:  years.map(y => +(byYear[y].profit  / 1e8).toFixed(1)),
        rates:    years.map(y => {
          const rev = byYear[y].revenue;
          return rev === 0 ? 0 : +(byYear[y].profit / rev * 100).toFixed(1);
        }),
      },
      stageChart: {
        labels:   stages,
        revenues: stages.map(s => +(byStage[s].revenue / 1e8).toFixed(1)),
        counts:   stages.map(s => byStage[s].count),
      },
    };
  }, [data, isLoading]);

  const emptyYearTrend  = { labels: [], revenues: [], profits: [], rates: [], options: yearTrendOptions };
  const emptyStageChart = { labels: [], revenues: [], counts: [], options: revExpOptions };

  if (!chartData || isLoading) {
    return {
      isLoading, isEmpty: false, showLabels, showLogScale, labelColor,
      revExp:        { labels: [], revenues: [], profits: [], options: revExpOptions },
      costBreakdown: { labels: [], values: [] },
      profitRate:    { labels: [], rates: [], isProfit: [], options: profitRateOptions },
      yearTrend:     emptyYearTrend,
      stageChart:    emptyStageChart,
    };
  }

  return {
    isLoading,
    isEmpty:      chartData.isEmpty,
    showLabels,
    showLogScale,
    labelColor,
    revExp:        { ...chartData.revExp,       options: revExpOptions },
    costBreakdown:   chartData.costBreakdown,
    profitRate:    { ...chartData.profitRate,   options: profitRateOptions },
    yearTrend:     { ...chartData.yearTrend,    options: yearTrendOptions },
    stageChart:    { ...chartData.stageChart,   options: revExpOptions },
  };
};
