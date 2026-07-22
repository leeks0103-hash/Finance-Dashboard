import { useMemo } from 'react';
import { useSummary } from '@/hooks/useSummary';
import type { ChartOptions } from 'chart.js';

// 차트 표시 옵션 — 포맷팅 로직을 ViewModel 레이어에서 관리
const REV_EXP_OPTIONS: ChartOptions<'bar'> = {
  layout: { padding: { right: 52 } },
  plugins: {
    datalabels: {
      display: true,
      anchor: 'end',
      align:  'end',
      color:  '#111827',
      font:   { size: 12, weight: 'bold' },
      formatter: (v: number) =>
        Math.abs(v) >= 1 ? `${v.toFixed(1)}억` : `${(v * 10).toFixed(0)}천만`,
    },
  },
} as ChartOptions<'bar'>;

const PROFIT_RATE_OPTIONS: ChartOptions<'bar'> = {
  layout: { padding: { top: 24 } },
  plugins: {
    datalabels: {
      display: true,
      anchor: 'end',
      align:  'top',
      offset: 2,
      color:  '#111827',
      font:   { size: 12, weight: 'bold' },
      formatter: (v: number) => `${v}%`,
    },
  },
  scales: { y: { ticks: { callback: (v: string | number) => v + '%' } } },
} as ChartOptions<'bar'>;

export interface ChartViewModel {
  isLoading: boolean;
  isEmpty:   boolean;
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

  return useMemo((): ChartViewModel => {
    if (!data || isLoading) {
      return {
        isLoading,
        isEmpty: false,
        revExp:       { labels: [], revenues: [], profits: [], options: REV_EXP_OPTIONS },
        costBreakdown: { labels: [], values: [] },
        profitRate:   { labels: [], rates: [], colors: [], options: PROFIT_RATE_OPTIONS },
      };
    }

    const parts   = Object.keys(data.by_part);
    const isEmpty = parts.length === 0;
    const cb      = data.cost_breakdown;

    return {
      isLoading,
      isEmpty,
      revExp: {
        labels:   parts,
        revenues: parts.map(p => +(data.by_part[p].revenue / 1e8).toFixed(2)),
        profits:  parts.map(p => +(data.by_part[p].profit  / 1e8).toFixed(2)),
        options:  REV_EXP_OPTIONS,
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
        options: PROFIT_RATE_OPTIONS,
      },
    };
  }, [data, isLoading]);
};
