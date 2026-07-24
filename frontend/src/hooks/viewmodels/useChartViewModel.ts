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
  isLoading:  boolean;
  isEmpty:    boolean;
  showLabels: boolean;
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
    isProfit: boolean[];   // true = 흑자, false = 적자
    options:  ChartOptions<'bar'>;
  };
  labelColor: string;  // 테마별 레이블 색 — ChartSection이 차트에 직접 전달
}

export const useChartViewModel = (labelColor: string): ChartViewModel => {
  const { data, isLoading } = useSummary();
  const showLabels = useUiStore(s => s.showChartLabels);

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
    scales: { y: { ticks: { callback: (v: string | number) => v + '%' } } },
  }), [showLabels, labelColor]);

  const chartData = useMemo(() => {
    if (!data || isLoading) return null;
    const parts   = Object.keys(data.by_part);
    const cb      = data.cost_breakdown;
    return {
      isEmpty: parts.length === 0,
      revExp: {
        labels:   parts,
        revenues: parts.map(p => +(data.by_part[p].revenue / 1e8).toFixed(2)),
        profits:  parts.map(p => +(data.by_part[p].profit  / 1e8).toFixed(2)),
      },
      costBreakdown: {
        labels: ['직접원가', '직접인건비', '공통원가/관리비'],
        values: [cb.direct_cost, cb.labor_cost, cb.overhead].map(v => +(v / 1e8).toFixed(2)),
      },
      profitRate: {
        labels:   parts,
        rates:    parts.map(p => {
          const rev = data.by_part[p].revenue;
          return rev === 0 ? 0 : +(data.by_part[p].profit / rev * 100).toFixed(1);
        }),
        isProfit: parts.map(p => data.by_part[p].profit >= 0),
      },
    };
  }, [data, isLoading]);

  if (!chartData || isLoading) {
    return {
      isLoading, isEmpty: false, showLabels, labelColor,
      revExp:        { labels: [], revenues: [], profits: [], options: revExpOptions },
      costBreakdown: { labels: [], values: [] },
      profitRate:    { labels: [], rates: [], isProfit: [], options: profitRateOptions },
    };
  }

  return {
    isLoading,
    isEmpty:   chartData.isEmpty,
    showLabels,
    labelColor,
    revExp:        { ...chartData.revExp,      options: revExpOptions },
    costBreakdown:   chartData.costBreakdown,
    profitRate:    { ...chartData.profitRate,  options: profitRateOptions },
  };
};
