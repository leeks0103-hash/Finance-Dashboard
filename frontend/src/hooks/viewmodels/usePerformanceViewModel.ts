import { useState, useMemo, useEffect } from 'react';
import { usePerformanceSummary } from '@/hooks/usePerformanceSummary';
import { usePerformanceData, usePerformanceOptions } from '@/hooks/usePerformanceData';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useCountUp } from '@/hooks/useCountUp';
import { useTheme } from '@/hooks/useTheme';
import { usePerfStore } from '@/store/perf.store';
import { useUiStore } from '@/store';
import { useQuickSearchStore } from '@/store/quickSearch.store';
import { formatEok, PERF_MONTH } from '@/utils';
import { makeBarOptions } from '@/utils/chartOptions';
import { getChartPalette } from '@/utils/chartColors';
import type { PerfProject } from '@/types/performance.types';
import type { ServerPagination, ServerSearch } from '@/components/ui/DataTable';
import type { ChartOptions } from 'chart.js';

const toEokNum = (v: number) => +(v / 100_000).toFixed(1);

// PERF_MONTH("7월") 기준 — 이후 달은 아직 실적이 없는 추정 구간이므로 흐릿하게 표시
const CURRENT_MONTH_NUM = parseInt(PERF_MONTH, 10);
const isFutureMonth = (label: string) => parseInt(label, 10) > CURRENT_MONTH_NUM;

// 팔레트의 rgba(...) 문자열 알파값만 교체 — 미래 월 흐림 처리용
const fadeAlpha = (rgba: string, alpha: number) => rgba.replace(/[\d.]+\)$/, `${alpha})`);

export interface PerfKpiCard {
  label:   string;
  value:   string;
  sub:     string;
  accent:  'brand' | 'warn' | 'profit' | 'loss' | 'purple';
  trendUp: boolean;
  trend?:  string;
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
  planInitialNum:  number;
  junActualNum:    number;
  junCostNum:      number;
  profitRateNum:   number;
  costRateStr:     string;
}

export interface PerfChartDataset {
  label:           string;
  data:            number[];
  backgroundColor: string | string[];
  borderRadius:    number;
}

export interface PerformanceViewModel {
  isLoading:     boolean;
  isFetching:    boolean;
  isEmpty:       boolean;
  kpiCards:      PerfKpiCard[];
  byPart:        PerfPartRow[];
  chartLabels:   string[];
  chartDatasets: PerfChartDataset[];
  chartOptions:  ChartOptions<'bar'>;
  chartTickColor: string;
  projects:      PerfProject[];
  parts:         string[];
  selectedParts: string[];
  togglePart:    (part: string) => void;
  resetFilters:  () => void;
  serverPagination: ServerPagination;
  serverSearch:     ServerSearch;
}

const SEARCH_FIELD_OPTIONS = [
  { value: '',             label: '전체' },
  { value: 'project_code', label: '프로젝트코드' },
  { value: 'project_name', label: '프로젝트명' },
  { value: 'manager',      label: '담당자' },
  { value: 'part',         label: '파트' },
  { value: 'team',         label: '팀' },
];

export const usePerformanceViewModel = (): PerformanceViewModel => {
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [searchField, setSearchField] = useState('');
  const search = useDebouncedSearch(350);

  // 실적 인사이트 코드 클릭 → 검색창 자동 채우기
  const perfQuick  = useQuickSearchStore(s => s.perf);
  const clearPerfQ = useQuickSearchStore(s => s.setPerf);
  useEffect(() => {
    if (!perfQuick) return;
    search.setFilter(perfQuick);
    setPage(1);
    clearPerfQ('');
  }, [perfQuick]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: summary,    isLoading: sumLoading } = usePerformanceSummary();
  const { data: paged,      isLoading: projLoading, isFetching } = usePerformanceData({
    page, pageSize, search: search.debouncedValue, field: searchField,
  });
  const { data: options } = usePerformanceOptions();
  const selectedParts = usePerfStore(s => s.selectedParts);
  const togglePart    = usePerfStore(s => s.togglePart);
  const reset         = usePerfStore(s => s.reset);

  const isLoading = sumLoading || projLoading;
  const total     = summary?.total;
  const monthly   = summary?.monthly ?? [];

  const junActualRaw = total?.jun_actual       ?? 0;
  const profitRaw    = total?.operating_profit ?? 0;
  const planRaw      = total?.plan_initial     ?? 0;
  const rateRaw      = total?.avg_profit_rate  ?? 0;
  const junCheckRaw  = total?.jun_check_total  ?? 0;

  const animJun    = useCountUp(toEokNum(junActualRaw));
  const animProfit = useCountUp(toEokNum(profitRaw));
  const animPlan   = useCountUp(toEokNum(planRaw));
  const animRate   = useCountUp(rateRaw);
  const animCheck  = useCountUp(toEokNum(junCheckRaw));

  const kpiCards: PerfKpiCard[] = useMemo(() => {
    if (!total) return [];
    const achieveRate = planRaw > 0 ? ((junActualRaw / planRaw) * 100).toFixed(1) : '-';

    // 전월 대비 계산 — monthly[]는 chk_m01~12 집계, 0-based 인덱스
    const currIdx = CURRENT_MONTH_NUM - 1;
    const curr = monthly[currIdx];
    const prev = currIdx > 0 ? monthly[currIdx - 1] : null;

    const momTag = (diffK: number | null): string | undefined => {
      if (diffK === null || !prev) return undefined;
      return `전월대비 ${Math.abs(diffK / 100_000).toFixed(1)}억`;
    };

    // 카드2: 이번달 점검 매출 vs 전월
    const momRevK  = curr && prev ? curr.revenue - prev.revenue : null;
    // 카드4: 이번달 (점검매출-원가) vs 전월
    const momProfK = curr && prev
      ? (curr.revenue - curr.cost) - (prev.revenue - prev.cost)
      : null;

    return [
      { label: '매출 계획 (최초)', value: `${animPlan.toFixed(1)}억원`, sub: `${total.count}개 프로젝트`, accent: 'brand', trendUp: true },
      { label: `${PERF_MONTH} 실적 집계`,    value: `${animJun.toFixed(1)}억원`,    sub: `달성률 ${achieveRate}%`,          accent: junActualRaw >= planRaw ? 'profit' : 'warn', trendUp: momRevK !== null ? momRevK >= 0 : junActualRaw >= planRaw,  trend: momTag(momRevK) },
      { label: `${PERF_MONTH} 점검 연간합계`, value: `${animCheck.toFixed(1)}억원`,  sub: `원가 ${formatEok(total.jun_cost)}`, accent: 'purple', trendUp: true },
      { label: '경상손익', value: `${animProfit.toFixed(1)}억원`, sub: `손익률 ${animRate.toFixed(1)}%`, accent: profitRaw >= 0 ? 'profit' : 'loss', trendUp: momProfK !== null ? momProfK >= 0 : profitRaw >= 0, trend: momTag(momProfK) },
    ];
  }, [total, monthly, animPlan, animJun, animCheck, animProfit, animRate, planRaw, junActualRaw, junCheckRaw, profitRaw]);

  const byPart = useMemo((): PerfPartRow[] => {
    if (!summary?.by_part) return [];
    return Object.entries(summary.by_part)
      .sort((a, b) => b[1].jun_actual - a[1].jun_actual)
      .map(([part, s]) => {
        const planInitialNum = toEokNum(s.plan_initial);
        const junActualNum   = toEokNum(s.jun_actual);
        const junCostNum     = toEokNum(s.jun_cost);
        const costRate = junActualNum > 0 ? `${((junCostNum / junActualNum) * 100).toFixed(1)}%` : '-';
        return {
          part,
          planInitial: formatEok(s.plan_initial), junActual: formatEok(s.jun_actual),
          junCost: formatEok(s.jun_cost), junCheckTotal: formatEok(s.jun_check_total),
          operatingProfit: formatEok(s.operating_profit), profitRate: `${s.avg_profit_rate.toFixed(1)}%`,
          count: s.count, isLoss: s.operating_profit < 0,
          planInitialNum, junActualNum, junCostNum, profitRateNum: s.avg_profit_rate, costRateStr: costRate,
        };
      });
  }, [summary?.by_part]);

  const projects: PerfProject[] = paged?.rows ?? [];

  const { theme } = useTheme();
  const dark = theme === 'dark';
  const palette = useMemo(() => getChartPalette(dark), [dark]);
  const showLabels = useUiStore(s => s.showChartLabels);
  const labelColor = dark ? 'rgba(255,255,255,0.95)' : '#111111';

  const chartLabels   = useMemo(() => monthly.map(m => m.month),   [monthly]);
  const chartDatasets = useMemo((): PerfChartDataset[] => [
    {
      label: '매출', data: monthly.map(m => +(m.revenue / 100_000).toFixed(1)),
      backgroundColor: monthly.map(m => isFutureMonth(m.month) ? fadeAlpha(palette.revenue, 0.25) : palette.revenue),
      borderRadius: 4,
    },
    {
      label: '원가', data: monthly.map(m => +(m.cost / 100_000).toFixed(1)),
      backgroundColor: monthly.map(m => isFutureMonth(m.month) ? fadeAlpha(palette.cost, 0.25) : palette.cost),
      borderRadius: 4,
    },
  ], [monthly, palette]);

  const chartOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    plugins: {
      datalabels: {
        anchor: 'end',
        align:  'end',
        // 좁은 화면 — 12개월 x 2계열 막대가 촘촘해지면 숫자가 겹쳐 안 보이므로 숨김
        display: (ctx: { chart: { width: number } }) =>
          showLabels && ctx.chart.width / (monthly.length * 2) > 20,
        formatter: (v: number) => `${v}억`,
      },
    },
  }), [showLabels, labelColor, monthly.length]);

  return {
    isLoading, isFetching: isFetching ?? false,
    isEmpty: !isLoading && !total,
    kpiCards, byPart, chartLabels, chartDatasets, chartOptions, chartTickColor: labelColor,
    projects,
    parts: options?.parts ?? [], selectedParts, togglePart, resetFilters: reset,

    serverPagination: {
      total:            paged?.total ?? 0,
      page, pageSize,
      onPageChange:     (p) => setPage(p),
      onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
    },

    serverSearch: {
      value:    search.inputValue,
      onChange: (val) => {
        search.handleChange({ target: { value: val } } as React.ChangeEvent<HTMLInputElement>);
        setPage(1);
      },
      field:        searchField,
      onFieldChange: (f) => { setSearchField(f); setPage(1); },
      fieldOptions:  SEARCH_FIELD_OPTIONS,
    },
  };
};
