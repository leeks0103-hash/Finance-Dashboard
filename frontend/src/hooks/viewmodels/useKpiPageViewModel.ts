import { useState, useMemo } from 'react';
import { useKpiSummary, useKpiData } from '@/hooks/useKpiSummary';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import type { KpiRawRow } from '@/types/kpi.types';
import type { InfiniteLoadMore } from '@/components/ui/DataTable';

export interface KpiChartDataset {
  label:           string;
  data:            number[];
  backgroundColor: string;
  borderRadius:    number;
}

export interface KpiChartData {
  labels:   string[];
  targets:  number[];
  actuals:  number[];
  datasets: KpiChartDataset[];
}

export interface KpiSummaryRow {
  name:        string;
  agg:         string;
  targetStr:   string;
  targetNum:   number;
  actual:      string;
  achieveRate: string;
  isGood:      boolean;
}

export interface KpiPageViewModel {
  isLoading:        boolean;
  isFetchingNext:   boolean;
  available:        boolean;
  message?:         string;
  chart:            KpiChartData;
  summaryRows:      KpiSummaryRow[];
  rawRows:          KpiRawRow[];
  rawCols:          string[];
  /** DataTable infiniteLoadMore prop에 그대로 전달 */
  infiniteLoadMore: InfiniteLoadMore;
  /** 서버 검색값 — DataTable serverSearch.value로 전달 */
  searchValue:      string;
  onSearchChange:   (val: string) => void;
}

const fmtNum = (v: number) => v !== 0 ? v.toLocaleString() : '0';

export const useKpiPageViewModel = (): KpiPageViewModel => {
  const [pageSize] = useState(30);
  const search = useDebouncedSearch(350);

  const { data: summary, isLoading: sumLoading } = useKpiSummary();
  const {
    data,
    isLoading:          dataLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useKpiData(search.debouncedValue, pageSize);

  const isLoading = sumLoading || dataLoading;
  const items     = summary?.items ?? [];
  const rawRows: KpiRawRow[] = data?.rows ?? [];

  const chart = useMemo((): KpiChartData => {
    const labels  = items.map(it => it.name.replace(/\s*\([^)]+\)\s*/g, ' ').trim());
    const targets = items.map(it => typeof it.target_2026 === 'number' ? it.target_2026 : 0);
    const actuals = items.map(it => it.actual_2026);
    return {
      labels, targets, actuals,
      datasets: [
        { label: '26년 목표', data: targets, backgroundColor: 'rgba(59,130,246,0.65)', borderRadius: 4 },
        { label: '26년 실적', data: actuals, backgroundColor: 'rgba(16,185,129,0.7)',  borderRadius: 4 },
      ],
    };
  }, [items]);

  const summaryRows = useMemo((): KpiSummaryRow[] =>
    items.map(it => ({
      name:       it.name,
      agg:        it.agg === 'sum' ? '합계' : '평균',
      targetStr:  typeof it.target_2026 === 'number' ? fmtNum(it.target_2026) : String(it.target_2026),
      targetNum:  typeof it.target_2026 === 'number' ? it.target_2026 : 0,
      actual:     fmtNum(it.actual_2026),
      achieveRate: it.achieve_rate !== null && it.achieve_rate !== undefined ? `${it.achieve_rate}%` : '-',
      isGood: (it.achieve_rate ?? 0) >= 100,
    })),
  [items]);

  // 컬럼은 첫 행 기준 — structuralSharing으로 rows 참조가 안정적이면 여기도 안정적
  const rawCols = useMemo(
    () => rawRows.length > 0 ? Object.keys(rawRows[0]) : [],
    [rawRows],
  );

  return {
    isLoading,
    isFetchingNext:   isFetchingNextPage,
    available:        summary?.available ?? false,
    message:          summary?.message,
    chart,
    summaryRows,
    rawRows,
    rawCols,

    infiniteLoadMore: {
      total:              data?.total ?? 0,
      hasNextPage:        hasNextPage ?? false,
      isFetchingNextPage: isFetchingNextPage,
      fetchNextPage,
    },

    searchValue:    search.inputValue,
    onSearchChange: (val) =>
      search.handleChange({ target: { value: val } } as React.ChangeEvent<HTMLInputElement>),
  };
};
