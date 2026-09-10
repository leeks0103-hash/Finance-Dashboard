import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePerformanceSummary } from '@/hooks/usePerformanceSummary';
import { usePerformanceData, usePerformanceOptions } from '@/hooks/usePerformanceData';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useReactPagination } from '@/lib/pagination';
import { useCountUp } from '@/hooks/useCountUp';
import { usePerfStore } from '@/store/perf.store';
import { useQuickSearchStore } from '@/store/quickSearch.store';
import { formatEok, PERF_MONTH } from '@/utils';
import { partRank } from '@/utils/partOrder';
import { getProjects } from '@/api/finance.api';
import { STALE_5MIN, GC_10MIN } from '@/hooks/queryClient';
import type { PerfProject } from '@/types/performance.types';
import type { Project, Filters } from '@/types/finance.types';
import type { ServerPagination, ServerSearch } from '@/components/ui/DataTable';

const FINANCE_EMPTY_FILTERS: Filters = { years: [], parts: [], stages: [] };

// 천원 → 억원. 백엔드에 없는 필드(서버 재시작 전 등)가 들어와도 NaN 대신 0이 되도록 방어
const toEokNum = (v: number | null | undefined) =>
  Number.isFinite(Number(v)) ? +(Number(v) / 100_000).toFixed(1) : 0;

const CURRENT_MONTH_NUM = parseInt(PERF_MONTH, 10);

type PerfAccent = 'brand' | 'warn' | 'profit' | 'loss' | 'purple';

/** 계획 → 추정(연간) 두 값을 나란히 비교하는 카드 (매출·원가·매출이익) */
export interface PerfCompareCardData {
  kind:    'compare';
  id:      string;
  label:   string;
  accent:  PerfAccent;
  planStr: string;   // "321.3억"
  estStr:  string;   // "376.5억"
  planNum: number;   // 억 (미니 막대용)
  estNum:  number;
  diffStr: string;   // "+55.2억" / "-3.1억"
  diffUp:  boolean;
}

/** 단일 값 카드 (경상손익·누계 실적) — 기존 형태 유지 */
export interface PerfSingleCardData {
  kind:    'single';
  id:      string;
  label:   string;
  value:   string;
  sub:     string;
  accent:  PerfAccent;
  trendUp: boolean;
  trend?:  string;
}

export type PerfKpiCard = PerfCompareCardData | PerfSingleCardData;

export interface PerfPartRow {
  part:            string;
  planInitial:     string;
  junActual:       string;
  junCost:         string;
  junCheckTotal:   string;
  /** 연간 추정 기준 경상손익 (엑셀 BF열) */
  operatingProfit: string;
  /** 연간 추정 기준 손익률 */
  profitRate:      string;
  /** 누계(1~기준월) 경상손익 — 누계매출·누계원가와 같은 기간 */
  accOperatingProfit: string;
  /** 누계 손익률 */
  accProfitRate:      string;
  /** 누계 경상손익이 음수인가 (연간 isLoss와 별개) */
  isAccLoss:          boolean;
  count:           number;
  isLoss:          boolean;
  planInitialNum:  number;
  junActualNum:    number;
  junCostNum:      number;
  profitRateNum:   number;
  costRateStr:     string;
  achieveRateNum:  number;
}

export interface PerformanceViewModel {
  isLoading:     boolean;
  isFetching:    boolean;
  isEmpty:       boolean;
  kpiCards:      PerfKpiCard[];
  byPart:        PerfPartRow[];
  projects:      PerfProject[];
  parts:         string[];
  selectedParts: string[];
  togglePart:    (part: string) => void;
  resetFilters:  () => void;
  serverPagination: ServerPagination;
  serverSearch:     ServerSearch;
  /** 2depth: 재무 데이터 검색 결과 */
  financeResults:    Project[];
  hasFinanceResults: boolean;
  financeSearchTerm: string;
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
  const pagination = useReactPagination(20);
  const [searchField, setSearchField] = useState('');
  const search = useDebouncedSearch(350);

  // 실적 인사이트 코드 클릭 → 검색창 자동 채우기
  const perfQuick  = useQuickSearchStore(s => s.perf);
  const clearPerfQ = useQuickSearchStore(s => s.setPerf);
  useEffect(() => {
    if (!perfQuick) return;
    search.setFilter(perfQuick);
    pagination.resetToFirstPage();
    clearPerfQ('');
  }, [perfQuick]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: summary,    isLoading: sumLoading } = usePerformanceSummary();
  const { data: paged,      isLoading: projLoading, isFetching } = usePerformanceData({
    page: pagination.page, pageSize: pagination.pageSize, search: search.debouncedValue, field: searchField,
  });
  const { data: options } = usePerformanceOptions();

  // 2depth: 실적 검색과 동일한 debounced 값으로 재무 API 병렬 조회
  const financeSearchEnabled = search.debouncedValue.trim().length > 0;
  const { data: financeData } = useQuery({
    queryKey: ['finance-2depth', search.debouncedValue],
    queryFn:  () => getProjects(FINANCE_EMPTY_FILTERS, {
      page: 1, pageSize: 50,
      search: search.debouncedValue,
      field: '',
    }).then(r => r.data),
    enabled:   financeSearchEnabled,
    staleTime: STALE_5MIN,
    gcTime:    GC_10MIN,
  });
  const financeResults: Project[] = financeData ?? [];
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

  const animJun    = useCountUp(toEokNum(junActualRaw));
  const animProfit = useCountUp(toEokNum(profitRaw));
  const animRate   = useCountUp(rateRaw);

  const kpiCards: PerfKpiCard[] = useMemo(() => {
    if (!total) return [];
    const achieveRate = planRaw > 0 ? ((junActualRaw / planRaw) * 100).toFixed(1) : '-';

    // 전월 대비 — monthly[]는 chk_m01~12 집계, 0-based 인덱스
    const currIdx = CURRENT_MONTH_NUM - 1;
    const curr = monthly[currIdx];
    const prev = currIdx > 0 ? monthly[currIdx - 1] : null;
    const momTag = (diffK: number | null): string | undefined =>
      (diffK === null || !prev) ? undefined : `전월대비 ${Math.abs(diffK / 100_000).toFixed(1)}억`;
    const momRevK  = curr && prev ? curr.revenue - prev.revenue : null;
    const momProfK = curr && prev ? (curr.revenue - curr.cost) - (prev.revenue - prev.cost) : null;

    // 계획 → 추정(연간) 2값 비교 카드. 값은 매출행/원가행 각각의 합 (천원 → 억)
    const mk = (
      id: string, label: string, accent: PerfAccent, planK: number, estK: number,
    ): PerfCompareCardData => {
      const p = toEokNum(planK);
      const e = toEokNum(estK);
      const d = +(e - p).toFixed(1);
      return {
        kind: 'compare', id, label, accent,
        planStr: `${p.toFixed(1)}억원`, estStr: `${e.toFixed(1)}억원`,
        planNum: p, estNum: e,
        diffStr: `${d >= 0 ? '+' : ''}${d.toFixed(1)}억원`, diffUp: d >= 0,
      };
    };

    return [
      mk('revenue',     '매출 (계획/추정)', 'brand',  total.plan_initial,   total.jun_check_total),
      mk('cost',        '원가 (계획/추정)', 'brand',  total.plan_cost,      total.jun_cost),
      mk('grossProfit', '매출이익 (계획/추정)',
         (total.jun_check_total - total.jun_cost) >= 0 ? 'profit' : 'loss',
         total.plan_initial - total.plan_cost, total.jun_check_total - total.jun_cost),
      // ↓ 언급 안 한 2개 카드는 그대로 유지 (경상손익 · 누계 실적)
      {
        kind: 'single', id: 'profit', label: '경상손익(당해년도 추정)',
        value: `${animProfit.toFixed(1)}억원`, sub: `손익률 ${animRate.toFixed(1)}%`,
        accent: profitRaw >= 0 ? 'profit' : 'loss',
        trendUp: momProfK !== null ? momProfK >= 0 : profitRaw >= 0, trend: momTag(momProfK),
      },
      {
        kind: 'single', id: 'junActual', label: `매출/원가 누계 실적 (1~${PERF_MONTH})`,
        value: `${animJun.toFixed(1)}억원`,
        sub: `원가 ${formatEok(total.jun_cost_actual)}원 · 계획 대비 ${achieveRate}%`,
        accent: junActualRaw >= planRaw ? 'profit' : 'warn',
        trendUp: momRevK !== null ? momRevK >= 0 : junActualRaw >= planRaw, trend: momTag(momRevK),
      },
    ];
  }, [total, monthly, animJun, animProfit, animRate, planRaw, junActualRaw, profitRaw]);

  const byPart = useMemo((): PerfPartRow[] => {
    if (!summary?.by_part) return [];
    return Object.entries(summary.by_part)
      .sort((a, b) => partRank(a[0]) - partRank(b[0]))   // 담당자 지정 고정 순서
      .map(([part, s]) => {
        const planInitialNum = toEokNum(s.plan_initial);
        const junActualNum   = toEokNum(s.jun_actual);
        const junCostNum     = toEokNum(s.jun_cost);
        const costRate = junActualNum > 0 ? `${((junCostNum / junActualNum) * 100).toFixed(1)}%` : '-';
        const achieveRateNum = planInitialNum > 0 ? (junActualNum / planInitialNum) * 100 : 0;
        return {
          part,
          planInitial: formatEok(s.plan_initial), junActual: formatEok(s.jun_actual),
          junCost: formatEok(s.jun_cost), junCheckTotal: formatEok(s.jun_check_total),
          operatingProfit: formatEok(s.operating_profit), profitRate: `${s.avg_profit_rate.toFixed(1)}%`,
          accOperatingProfit: formatEok(s.acc_operating_profit),
          accProfitRate: `${(s.acc_profit_rate ?? 0).toFixed(1)}%`,
          isAccLoss: (s.acc_operating_profit ?? 0) < 0,
          count: s.count, isLoss: s.operating_profit < 0,
          planInitialNum, junActualNum, junCostNum, profitRateNum: s.avg_profit_rate, costRateStr: costRate,
          achieveRateNum,
        };
      });
  }, [summary?.by_part]);

  const projects: PerfProject[] = paged?.rows ?? [];

  return {
    isLoading, isFetching: isFetching ?? false,
    isEmpty: !isLoading && !total,
    kpiCards, byPart,
    projects,
    parts: options?.parts ?? [], selectedParts, togglePart, resetFilters: reset,

    serverPagination: {
      total:            paged?.total ?? 0,
      page:             pagination.page,
      pageSize:         pagination.pageSize,
      onPageChange:     pagination.setPage,
      onPageSizeChange: pagination.setPageSize,
    },

    serverSearch: {
      value:    search.inputValue,
      onChange: (val) => {
        search.handleChange({ target: { value: val } } as React.ChangeEvent<HTMLInputElement>);
        pagination.resetToFirstPage();
      },
      field:        searchField,
      onFieldChange: (f) => { setSearchField(f); pagination.resetToFirstPage(); },
      fieldOptions:  SEARCH_FIELD_OPTIONS,
    },

    financeResults,
    hasFinanceResults: financeSearchEnabled && financeResults.length > 0,
    financeSearchTerm: search.debouncedValue,
  };
};
