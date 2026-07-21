import { useSummary } from '@/hooks/useSummary';

export interface ChartViewModel {
  isLoading: boolean;
  isEmpty:   boolean;
  revExp: {
    labels:   string[];
    revenues: number[];
    profits:  number[];
  };
  costBreakdown: {
    labels: string[];
    values: number[];
  };
  profitRate: {
    labels: string[];
    rates:  number[];
    colors: string[];
  };
}

export const useChartViewModel = (): ChartViewModel => {
  const { data, isLoading } = useSummary();

  if (!data || isLoading) {
    return {
      isLoading,
      isEmpty: true,
      revExp: { labels: [], revenues: [], profits: [] },
      costBreakdown: { labels: [], values: [] },
      profitRate: { labels: [], rates: [], colors: [] },
    };
  }

  const parts = Object.keys(data.by_part);
  const isEmpty = parts.length === 0;
  const cb = data.cost_breakdown;

  return {
    isLoading,
    isEmpty,
    revExp: {
      labels:   parts,
      revenues: parts.map(p => +(data.by_part[p].revenue / 1e8).toFixed(2)),
      profits:  parts.map(p => +(data.by_part[p].profit  / 1e8).toFixed(2)),
    },
    costBreakdown: {
      labels: ['직접원가', '직접인건비', '공통원가/관리비'],
      values: [cb.direct_cost, cb.labor_cost, cb.overhead].map(v => +(v / 1e4).toFixed(0)),
    },
    profitRate: {
      labels: parts,
      rates: parts.map(p =>
        +(data.by_part[p].profit / (data.by_part[p].revenue || 1) * 100).toFixed(1)
      ),
      colors: parts.map(p =>
        data.by_part[p].profit >= 0 ? 'rgba(5,150,105,0.75)' : 'rgba(220,38,38,0.75)'
      ),
    },
  };
};
