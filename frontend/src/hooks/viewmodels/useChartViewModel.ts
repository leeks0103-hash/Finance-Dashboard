import { useMemo, useState, useCallback } from 'react';
import { useSummary } from '@/hooks/useSummary';
import type { ChartOptions } from 'chart.js';

// 기본 옵션 — display는 showLabels 상태로 덮어씀
const makeRevExpOptions = (display: boolean): ChartOptions<'bar'> => ({
  layout: { padding: { right: 52 } },
  plugins: {
    datalabels: {
      display,
      anchor: 'end',
      align:  'end',
      color:  '#111827',
      font:   { size: 12, weight: 'bold' },
      formatter: (v: number) =>
        Math.abs(v) >= 1 ? `${v.toFixed(1)}억` : `${(v * 10).toFixed(0)}천만`,
    },
  },
} as ChartOptions<'bar'>);

const makeProfitRateOptions = (display: boolean): ChartOptions<'bar'> => ({
  layout: { padding: { top: 24 } },
  plugins: {
    datalabels: {
      display,
      anchor: 'end',
      align:  'top',
      offset: 2,
      color:  '#111827',
      font:   { size: 12, weight: 'bold' },
      formatter: (v: number) => `${v}%`,
    },
  },
  scales: { y: { ticks: { callback: (v: string | number) => v + '%' } } },
} as ChartOptions<'bar'>);

export interface ChartViewModel {
  isLoading:    boolean;
  isEmpty:      boolean;
  showLabels:   boolean;
  toggleLabels: () => void;
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
    labels:  string[];
    rates:   number[];
    colors:  string[];
    options: ChartOptions<'bar'>;
  };
}

export const useChartViewModel = (): ChartViewModel => {
  const { data, isLoading } = useSummary();
  const [showLabels, setShowLabels] = useState(false);
  const toggleLabels = useCallback(() => setShowLabels(s => !s), []);

  // 옵션은 showLabels 변경 시만 재생성
  const revExpOptions      = useMemo(() => makeRevExpOptions(showLabels),      [showLabels]);
  const profitRateOptions  = useMemo(() => makeProfitRateOptions(showLabels),  [showLabels]);

  const chartData = useMemo(() => {
    if (!data || isLoading) return null;

    const parts   = Object.keys(data.by_part);
    const isEmpty = parts.length === 0;
    const cb      = data.cost_breakdown;

    return {
      isEmpty,
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
        labels: parts,
        rates: parts.map(p => {
          const rev = data.by_part[p].revenue;
          return rev === 0 ? 0 : +(data.by_part[p].profit / rev * 100).toFixed(1);
        }),
        colors: parts.map(p =>
          data.by_part[p].profit >= 0 ? 'rgba(5,150,105,0.75)' : 'rgba(220,38,38,0.75)'
        ),
      },
    };
  }, [data, isLoading]);

  if (!chartData || isLoading) {
    return {
      isLoading, isEmpty: false, showLabels, toggleLabels,
      revExp:       { labels: [], revenues: [], profits: [], options: revExpOptions },
      costBreakdown: { labels: [], values: [] },
      profitRate:   { labels: [], rates: [], colors: [], options: profitRateOptions },
    };
  }

  return {
    isLoading,
    isEmpty:      chartData.isEmpty,
    showLabels,
    toggleLabels,
    revExp:        { ...chartData.revExp,       options: revExpOptions },
    costBreakdown:   chartData.costBreakdown,
    profitRate:    { ...chartData.profitRate,   options: profitRateOptions },
  };
};
