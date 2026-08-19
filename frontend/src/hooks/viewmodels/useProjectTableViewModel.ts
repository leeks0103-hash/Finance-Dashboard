import { useState, useCallback, useEffect } from 'react';
import { useProjects } from '@/hooks/useProjects';
import { useSummary } from '@/hooks/useSummary';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useQuickSearchStore } from '@/store/quickSearch.store';
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

const SEARCH_FIELD_OPTIONS = [
  { value: '',            label: '전체' },
  { value: 'project_code', label: '프로젝트코드' },
  { value: 'part',         label: '파트' },
  { value: 'stage',        label: '보고단계' },
  { value: 'note',         label: '비고' },
  { value: 'filename',     label: '파일명' },
];

export const useProjectTableViewModel = (): ProjectTableViewModel => {
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [searchField, setSearchField] = useState('');
  const search = useDebouncedSearch(350);

  // 인사이트 섹션 코드 클릭 → 검색창 자동 채우기
  const financeQuick    = useQuickSearchStore(s => s.finance);
  const clearFinanceQ   = useQuickSearchStore(s => s.setFinance);
  useEffect(() => {
    if (!financeQuick) return;
    search.setFilter(financeQuick);
    setPage(1);
    clearFinanceQ('');
  }, [financeQuick]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: paged, isLoading, isFetching } = useProjects({
    page,
    pageSize,
    search: search.debouncedValue,
    field:  searchField,
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
      field:        searchField,
      onFieldChange: (f) => { setSearchField(f); setPage(1); },
      fieldOptions:  SEARCH_FIELD_OPTIONS,
    },
  };
};
