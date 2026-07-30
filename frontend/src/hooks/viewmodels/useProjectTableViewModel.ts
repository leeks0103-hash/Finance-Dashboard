import { useState, useCallback } from 'react';
import { useProjects } from '@/hooks/useProjects';
import { useSummary } from '@/hooks/useSummary';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { formatBillion, formatRate } from '@/utils';
import type { Project } from '@/types';
import type { ServerPagination, ServerSearch } from '@/components/ui/DataTable';

export interface TableSummary {
  revenue:         string;
  expenditure:     string;
  directCost:      string;
  laborCost:       string;
  overhead:        string;
  operatingProfit: string;
  avgProfitRate:   string;
  count:           number;
}

export interface ProjectTableViewModel {
  rows:             Project[];
  total:            number;
  isLoading:        boolean;
  isFetching:       boolean;
  summary:          TableSummary;
  getRowVariant:    (row: Project) => 'loss' | 'warn' | '';
  serverPagination: ServerPagination;
  serverSearch:     ServerSearch;
}

const EMPTY_SUMMARY: TableSummary = {
  revenue: '-', expenditure: '-', directCost: '-',
  laborCost: '-', overhead: '-', operatingProfit: '-',
  avgProfitRate: '-', count: 0,
};

export const useProjectTableViewModel = (): ProjectTableViewModel => {
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const search = useDebouncedSearch(350);

  const { data: paged, isLoading, isFetching } = useProjects({
    page,
    pageSize,
    search: search.debouncedValue,
  });

  // 합계는 /api/summary (전체 필터 기준) — 페이지네이션 여부와 무관한 전체 집계값
  const { data: sumData } = useSummary();

  const summary: TableSummary = sumData ? {
    revenue:         formatBillion(sumData.total_revenue),
    expenditure:     formatBillion(sumData.total_expenditure),
    directCost:      formatBillion(sumData.cost_breakdown.direct_cost),
    laborCost:       formatBillion(sumData.cost_breakdown.labor_cost),
    overhead:        formatBillion(sumData.cost_breakdown.overhead),
    operatingProfit: formatBillion(sumData.total_profit),
    avgProfitRate:   formatRate(sumData.avg_profit_rate),
    count:           sumData.count,
  } : EMPTY_SUMMARY;

  return {
    rows:      paged?.rows  ?? [],
    total:     paged?.total ?? 0,
    isLoading,
    isFetching,
    summary,

    getRowVariant: useCallback((row: Project): 'loss' | 'warn' | '' => {
      if (row.operating_profit < 0) return 'loss';
      if (row.profit_rate >= 0 && row.profit_rate < 5) return 'warn';
      return '';
    }, []),

    serverPagination: {
      total:            paged?.total ?? 0,
      page,
      pageSize,
      onPageChange:     (p) => setPage(p),
      onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
    },

    serverSearch: {
      value:    search.inputValue,
      onChange: (val) => {
        search.handleChange({ target: { value: val } } as React.ChangeEvent<HTMLInputElement>);
        setPage(1);
      },
    },
  };
};
