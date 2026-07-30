import { useMemo, type ReactNode } from 'react';
import { usePerformanceSummary } from '@/hooks/usePerformanceSummary';
import { usePerformanceData } from '@/hooks/usePerformanceData';
import { usePerformanceOptions } from '@/hooks/usePerformanceData';
import { useCountUp } from '@/hooks/useCountUp';
import { usePerfStore } from '@/store/perf.store';
import { formatEok } from '@/utils';
import type { PerfProject } from '@/types/performance.types';

// 천원 → 억원 (숫자용)
const toEokNum = (v: number) => +(v / 100_000).toFixed(1);

export interface PerfKpiCard {
  label:   string;
  value:   string;
  sub:     string;
  accent:  'brand' | 'warn' | 'profit' | 'loss' | 'purple';
  trendUp: boolean;
}

export interface PerfPartRow {
  part:            string;
  planInitial:     string;
  junActual:       string;
  junCost:         string;
  junCheckTotal:   string;
  operatingProfit: string;
  profitRate:      string;
  count:           number;
  isLoss:          boolean;
  // 차트용 숫자
  planInitialNum:  number;
  junActualNum:    number;
  junCostNum:      number;
  profitRateNum:   number;
  costRateStr:     string;
}

export interface PerfChartDataset {
  label:           string;
  data:            number[];
  backgroundColor: string;
  borderRadius:    number;
}

export interface PerformanceViewModel {
  isLoading:    boolean;
  isFetching:   boolean;
  isEmpty:      boolean;
  kpiCards:     PerfKpiCard[];
  byPart:       PerfPartRow[];
  chartLabels:  string[];
  chartDatasets: PerfChartDataset[];
  projects:     PerfProject[];
  /** 프로젝트 상세 합계 행 — pages/에서 직접 reduce 금지 */
  footer:       Record<string, ReactNode> | undefined;
  parts:        string[];
  selectedParts: string[];
  togglePart:   (part: string) => void;
  resetFilters: () => void;
}

export const usePerformanceViewModel = (): PerformanceViewModel => {
  const { data: summary, isLoading: sumLoading } = usePerformanceSummary();
  const { data: rawProjects, isLoading: projLoading, isFetching } = usePerformanceData();
  const { data: options } = usePerformanceOptions();
  const selectedParts = usePerfStore(s => s.selectedParts);
  const togglePart    = usePerfStore(s => s.togglePart);
  const reset         = usePerfStore(s => s.reset);

  const isLoading = sumLoading || projLoading;
  const total     = summary?.total;

  const junActualRaw = total?.jun_actual        ?? 0;
  const profitRaw    = total?.operating_profit  ?? 0;
  const planRaw      = total?.plan_initial      ?? 0;
  const rateRaw      = total?.avg_profit_rate   ?? 0;
  const junCheckRaw  = total?.jun_check_total   ?? 0;

  const animJun    = useCountUp(toEokNum(junActualRaw));
  const animProfit = useCountUp(toEokNum(profitRaw));
  const animPlan   = useCountUp(toEokNum(planRaw));
  const animRate   = useCountUp(rateRaw);
  const animCheck  = useCountUp(toEokNum(junCheckRaw));

  const kpiCards: PerfKpiCard[] = useMemo(() => {
    if (!total) return [];
    const achieveRate = planRaw > 0 ? ((junActualRaw / planRaw) * 100).toFixed(1) : '-';
    return [
      {
        label:   '매출 계획 (최초)',
        value:   `${animPlan.toFixed(1)}억원`,
        sub:     `${total.count}개 프로젝트`,
        accent:  'brand',
        trendUp: true,
      },
      {
        label:   '6월 실적 집계',
        value:   `${animJun.toFixed(1)}억원`,
        sub:     `달성률 ${achieveRate}%`,
        accent:  junActualRaw >= planRaw ? 'profit' : 'warn',
        trendUp: junActualRaw >= planRaw,
      },
      {
        label:   '6월 점검 연간합계',
        value:   `${animCheck.toFixed(1)}억원`,
        sub:     `원가 ${formatEok(total.jun_cost)}`,
        accent:  'purple',
        trendUp: true,
      },
      {
        label:   '경상손익',
        value:   `${animProfit.toFixed(1)}억원`,
        sub:     `손익률 ${animRate.toFixed(1)}%`,
        accent:  profitRaw >= 0 ? 'profit' : 'loss',
        trendUp: profitRaw >= 0,
      },
    ];
  }, [total, animPlan, animJun, animCheck, animProfit, animRate,
      planRaw, junActualRaw, junCheckRaw, profitRaw, rateRaw]);

  const byPart = useMemo((): PerfPartRow[] => {
    if (!summary?.by_part) return [];
    return Object.entries(summary.by_part)
      .sort((a, b) => b[1].jun_actual - a[1].jun_actual)
      .map(([part, s]) => {
        const planInitialNum = toEokNum(s.plan_initial);
        const junActualNum   = toEokNum(s.jun_actual);
        const junCostNum     = toEokNum(s.jun_cost);
        const costRate = junActualNum > 0
          ? `${((junCostNum / junActualNum) * 100).toFixed(1)}%`
          : '-';
        return {
          part,
          planInitial:     formatEok(s.plan_initial),
          junActual:       formatEok(s.jun_actual),
          junCost:         formatEok(s.jun_cost),
          junCheckTotal:   formatEok(s.jun_check_total),
          operatingProfit: formatEok(s.operating_profit),
          profitRate:      `${s.avg_profit_rate.toFixed(1)}%`,
          count:           s.count,
          isLoss:          s.operating_profit < 0,
          planInitialNum,
          junActualNum,
          junCostNum,
          profitRateNum:   s.avg_profit_rate,
          costRateStr:     costRate,
        };
      });
  }, [summary?.by_part]);

  const projects = useMemo(
    () => Array.isArray(rawProjects) ? rawProjects : [],
    [rawProjects],
  );

  // 월별 차트
  const monthly = summary?.monthly ?? [];
  const chartLabels   = useMemo(() => monthly.map(m => m.month), [monthly]);
  const chartDatasets = useMemo((): PerfChartDataset[] => [
    {
      label:           '월별 실적',
      data:            monthly.map(m => +(m.revenue / 100_000).toFixed(1)),
      backgroundColor: 'rgba(59,130,246,0.65)',
      borderRadius:    4,
    },
  ], [monthly]);

  // 프로젝트 상세 합계 — 집계 로직은 ViewModel 책임
  const footer = useMemo((): Record<string, ReactNode> | undefined => {
    if (!projects.length) return undefined;
    const plan      = projects.reduce((s, r) => s + r.plan_initial, 0);
    const junAct    = projects.reduce((s, r) => s + r.jun_actual, 0);
    const opProfit  = projects.reduce((s, r) => s + r.operating_profit, 0);
    return {
      project_code:     <span style={{ fontWeight: 700 }}>합계</span>,
      plan_initial:     formatEok(plan),
      jun_actual:       formatEok(junAct),
      operating_profit: (
        <span style={{ color: opProfit < 0 ? 'var(--loss)' : 'var(--profit)', fontWeight: 600 }}>
          {formatEok(opProfit)}
        </span>
      ),
    };
  }, [projects]);

  return {
    isLoading,
    isFetching:   isFetching ?? false,
    isEmpty:      !isLoading && !total,
    kpiCards,
    byPart,
    chartLabels,
    chartDatasets,
    projects,
    footer,
    parts:        options?.parts ?? [],
    selectedParts,
    togglePart,
    resetFilters: reset,
  };
};
