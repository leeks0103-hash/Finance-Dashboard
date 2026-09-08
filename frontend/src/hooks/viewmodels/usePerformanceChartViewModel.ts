import { useMemo } from 'react';
import { usePerformanceSummary } from '@/hooks/usePerformanceSummary';
import { useUiStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { makeBarOptions } from '@/utils/chartOptions';
import { getChartTheme } from '@/utils/chartColors';
import { sortProgress } from '@/utils/progressOrder';
import { sortParts } from '@/utils/partOrder';
import { PERF_MONTH, stripPartPrefix } from '@/utils';
import type { ChartOptions } from 'chart.js';

const toEokNum = (v: number) => +(v / 100_000).toFixed(1);

// PERF_MONTH("7월") 기준 — 이후 달은 아직 실적이 없는 추정 구간이므로 흐릿하게 표시
const CURRENT_MONTH_NUM = parseInt(PERF_MONTH, 10);
const isFutureMonth = (label: string) => parseInt(label, 10) > CURRENT_MONTH_NUM;

export interface PerformanceChartViewModel {
  isLoading:  boolean;
  isError:    boolean;
  isEmpty:    boolean;
  showLabels: boolean;
  labelColor: string;
  monthly: {
    labels:   string[];
    revenues: number[];
    costs:    number[];
    isFuture: boolean[];
    options:  ChartOptions<'bar'>;
  };
  planVsActual: {
    labels:        string[];
    planInitial:   number[];
    /** 연간 추정 실적(BE열) — 계획이 연간 기준이라 누계 실적(1~N월) 대신 같은 기간끼리 비교 */
    junCheckTotal: number[];
    options:     ChartOptions<'bar'>;
  };
  profitRate: {
    labels:   string[];
    rates:    number[];
    profits:  number[];
    isProfit: boolean[];
    options:  ChartOptions<'bar'>;
  };
  costBreakdown: {
    labels: string[];
    values: number[];
  };
  progress: {
    labels:       string[];
    revenues:     number[];
    expenditures: number[];
    options:      ChartOptions<'bar'>;
  };
}

export const usePerformanceChartViewModel = (): PerformanceChartViewModel => {
  const { data: summary, isLoading, isError } = usePerformanceSummary();
  const showLabels = useUiStore(s => s.showChartLabels);
  const { theme } = useTheme();
  const { labelColor } = getChartTheme(theme === 'dark');

  const monthlyLength = summary?.monthly.length ?? 12;

  const monthlyOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    // 세로 막대 + align:'end'(막대 위) — 최고값 막대의 수치가 캔버스 상단에 잘리지 않게 여백 확보
    layout: { padding: { top: 24 } },
    plugins: {
      datalabels: {
        anchor: 'end',
        align:  'end',
        display: (ctx: { chart: { width: number } }) =>
          showLabels && ctx.chart.width / (monthlyLength * 2) > 20,
        formatter: (v: number) => `${v}억`,
      },
    },
  }), [showLabels, labelColor, monthlyLength]);

  const planVsActualOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    layout: { padding: { right: 52 } },
    plugins: {
      datalabels: {
        anchor: 'end',
        align:  'end',
        formatter: (v: number) => `${v}억`,
      },
    },
  }), [showLabels, labelColor]);

  const profitRateOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    // bottom — 마이너스 막대는 수치가 막대 아래에 찍히므로 잘리지 않게 여백 확보
    layout: { padding: { top: 24, bottom: 24 } },
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

  const progressOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    layout: { padding: { right: 52 } },
    plugins: {
      datalabels: {
        anchor: 'end',
        align:  'end',
        formatter: (v: number) => `${v}억`,
      },
    },
  }), [showLabels, labelColor]);

  const chartData = useMemo(() => {
    if (!summary || isLoading) return null;

    const monthly = summary.monthly;
    const parts   = sortParts(Object.keys(summary.by_part));
    const total   = summary.total;
    const progressEntries = sortProgress(Object.keys(summary.by_progress ?? {}));

    return {
      isEmpty: parts.length === 0 && monthly.length === 0,
      monthly: {
        labels:   monthly.map(m => m.month),
        revenues: monthly.map(m => toEokNum(m.revenue)),
        costs:    monthly.map(m => toEokNum(m.cost)),
        isFuture: monthly.map(m => isFutureMonth(m.month)),
      },
      planVsActual: {
        labels:        parts.map(stripPartPrefix),
        planInitial:   parts.map(p => toEokNum(summary.by_part[p].plan_initial)),
        junCheckTotal: parts.map(p => toEokNum(summary.by_part[p].jun_check_total)),
      },
      profitRate: {
        labels:   parts.map(stripPartPrefix),
        rates:    parts.map(p => summary.by_part[p].avg_profit_rate),
        profits:  parts.map(p => toEokNum(summary.by_part[p].operating_profit)),
        isProfit: parts.map(p => summary.by_part[p].operating_profit >= 0),
      },
      // ⚠️ 카드 제목은 "프로젝트 평균 원가비율"이지만 계산은 **전체 합계 구성비**(금액 가중)다.
      //    프로젝트별 비율의 단순평균이 아니다 — 2026-09-08 담당자 확인 후 합계 유지로 확정.
      //    (실측 차이: 직접원가 합계 67.5% vs 프로젝트 단순평균 56.7%)
      //    ⓘ 설명(INFO_COST_BREAKDOWN)에는 "전체 합산 후 항목별 구성비"로 정확히 안내 중.
      costBreakdown: {
        labels: ['직접원가', '인건비', '공통원가', '관리비'],
        values: [total.cost_direct, total.cost_labor, total.cost_overhead, total.cost_mgmt].map(toEokNum),
      },
      progress: {
        labels:       progressEntries,
        revenues:     progressEntries.map(p => toEokNum(summary.by_progress[p].revenue)),
        expenditures: progressEntries.map(p => toEokNum(summary.by_progress[p].cost)),
      },
    };
  }, [summary, isLoading]);

  if (!chartData || isLoading) {
    return {
      isLoading, isError, isEmpty: false, showLabels, labelColor,
      monthly:       { labels: [], revenues: [], costs: [], isFuture: [], options: monthlyOptions },
      planVsActual:  { labels: [], planInitial: [], junCheckTotal: [], options: planVsActualOptions },
      profitRate:    { labels: [], rates: [], profits: [], isProfit: [], options: profitRateOptions },
      costBreakdown: { labels: [], values: [] },
      progress:      { labels: [], revenues: [], expenditures: [], options: progressOptions },
    };
  }

  return {
    isLoading, isError, isEmpty: chartData.isEmpty, showLabels, labelColor,
    monthly:       { ...chartData.monthly,      options: monthlyOptions },
    planVsActual:  { ...chartData.planVsActual, options: planVsActualOptions },
    profitRate:    { ...chartData.profitRate,   options: profitRateOptions },
    costBreakdown:   chartData.costBreakdown,
    progress:      { ...chartData.progress,     options: progressOptions },
  };
};
