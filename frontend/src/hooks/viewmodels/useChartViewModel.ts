import { useMemo } from 'react';
import { useSummary } from '@/hooks/useSummary';
import { useUiStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { makeBarOptions } from '@/utils/chartOptions';
import { sortParts } from '@/utils/partOrder';
import { getChartTheme } from '@/utils/chartColors';
import { sortStages } from '@/utils/stageOrder';
import type { ChartOptions } from 'chart.js';

export interface ChartViewModel {
  isLoading:    boolean;
  isError:      boolean;
  isEmpty:      boolean;
  showLabels:   boolean;
  revExp: {
    labels:       string[];
    revenues:     number[];
    expenditures: number[];
    profits:      number[];
    options:      ChartOptions<'bar'>;
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
  stageChart: {
    labels:       string[];
    revenues:     number[];
    expenditures: number[];
    counts:       number[];
    options:      ChartOptions<'bar'>;
  };
  labelColor: string;
}

export const useChartViewModel = (): ChartViewModel => {
  const { data, isLoading, isError } = useSummary();
  const showLabels = useUiStore(s => s.showChartLabels);
  const { theme } = useTheme();
  const { labelColor } = getChartTheme(theme === 'dark');

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
        type: 'linear' as const,
        ticks: { callback: (v: string | number) => v + '%' },
      },
    },
  }), [showLabels, labelColor]);

  const chartData = useMemo(() => {
    if (!data || isLoading) return null;
    const parts   = sortParts(Object.keys(data.by_part));
    const cb      = data.cost_breakdown;
    const byStage = data.by_stage ?? {};
    const stages  = sortStages(Object.keys(byStage));

    return {
      isEmpty: parts.length === 0,
      revExp: {
        labels:       parts,
        revenues:     parts.map(p => +(data.by_part[p].revenue     / 1e8).toFixed(1)),
        expenditures: parts.map(p => +(data.by_part[p].expenditure / 1e8).toFixed(1)),
        profits:      parts.map(p => +(data.by_part[p].profit      / 1e8).toFixed(1)),
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
      stageChart: {
        labels:       stages,
        revenues:     stages.map(s => +(byStage[s].revenue     / 1e8).toFixed(1)),
        expenditures: stages.map(s => +(byStage[s].expenditure / 1e8).toFixed(1)),
        counts:       stages.map(s => byStage[s].count),
      },
    };
  }, [data, isLoading]);

  const emptyStageChart = { labels: [], revenues: [], expenditures: [], counts: [], options: revExpOptions };

  if (!chartData || isLoading) {
    return {
      isLoading, isError, isEmpty: false, showLabels, labelColor,
      revExp:        { labels: [], revenues: [], expenditures: [], profits: [], options: revExpOptions },
      costBreakdown: { labels: [], values: [] },
      profitRate:    { labels: [], rates: [], isProfit: [], options: profitRateOptions },
      stageChart:    emptyStageChart,
    };
  }

  return {
    isLoading,
    isError,
    isEmpty:      chartData.isEmpty,
    showLabels,
    labelColor,
    revExp:        { ...chartData.revExp,       options: revExpOptions },
    costBreakdown:   chartData.costBreakdown,
    profitRate:    { ...chartData.profitRate,   options: profitRateOptions },
    stageChart:    { ...chartData.stageChart,   options: revExpOptions },
  };
};
