import { useState, useCallback, useMemo } from 'react';
import { type SortingState } from '@tanstack/react-table';
import { useProjects } from '@/hooks/useProjects';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { formatBillion, formatRate } from '@/utils';
import type { Project } from '@/types';

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
  data:            Project[];
  isLoading:       boolean;
  isFetching:      boolean;
  busy:            boolean;
  sorting:         SortingState;
  onSortingChange: React.Dispatch<React.SetStateAction<SortingState>>;
  globalFilter:    string;
  onFilterChange:  React.Dispatch<React.SetStateAction<string>>;
  inputValue:      string;
  handleSearch:    (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearSearch:     () => void;
  summary:         TableSummary;
  getRowVariant:   (row: Project) => 'loss' | 'warn' | '';
  getPageLabel:    (pageIndex: number, pageCount: number) => string;
  getPageNumbers:  (currentPage: number, totalPages: number, windowSize?: number) => number[];
}

export const useProjectTableViewModel = (): ProjectTableViewModel => {
  const { data = [], isLoading, isFetching } = useProjects();
  const [sorting, setSorting] = useState<SortingState>([]);

  const {
    inputValue,
    debouncedValue: globalFilter,
    handleChange: handleSearch,
    reset: clearSearch,
  } = useDebouncedSearch(350);

  // 합계 행 — 서버 필터 기준 전체 합산
  const summary = useMemo((): TableSummary => {
    if (!data.length) return {
      revenue: '-', expenditure: '-', directCost: '-',
      laborCost: '-', overhead: '-', operatingProfit: '-',
      avgProfitRate: '-', count: 0,
    };
    const sum = (key: keyof Project) =>
      data.reduce((a, r) => a + (Number(r[key]) || 0), 0);
    const rates = data.map(r => r.profit_rate).filter(v => isFinite(v) && v > 0);
    const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    return {
      revenue:         formatBillion(sum('revenue')),
      expenditure:     formatBillion(sum('expenditure')),
      directCost:      formatBillion(sum('direct_cost')),
      laborCost:       formatBillion(sum('labor_cost')),
      overhead:        formatBillion(sum('overhead')),
      operatingProfit: formatBillion(sum('operating_profit')),
      avgProfitRate:   formatRate(avgRate),
      count:           data.length,
    };
  }, [data]);

  return {
    data,
    isLoading,
    isFetching,
    busy: isLoading || isFetching,
    sorting,
    onSortingChange: setSorting,
    globalFilter,
    onFilterChange:  () => {},
    inputValue,
    handleSearch,
    clearSearch,
    summary,
    getRowVariant: useCallback((row: Project): 'loss' | 'warn' | '' => {
      if (row.operating_profit < 0) return 'loss';
      if (row.profit_rate >= 0 && row.profit_rate < 5) return 'warn';
      return '';
    }, []),
    getPageLabel: useCallback(
      (pageIndex: number, pageCount: number): string =>
        pageCount > 0 ? `${pageIndex + 1} / ${pageCount}` : '0 / 0',
      []
    ),
    getPageNumbers: useCallback(
      (currentPage: number, totalPages: number, windowSize = 5): number[] => {
        if (totalPages <= windowSize) return Array.from({ length: totalPages }, (_, i) => i);
        const half = Math.floor(windowSize / 2);
        const start = Math.max(0, Math.min(currentPage - half, totalPages - windowSize));
        return Array.from({ length: windowSize }, (_, i) => start + i);
      },
      []
    ),
  };
};
