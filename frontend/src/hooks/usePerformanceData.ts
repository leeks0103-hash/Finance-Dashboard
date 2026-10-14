import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getPerfData, getPerfOptions } from '@/api/performance.api';
import { usePerfStore } from '@/store/perf.store';
import type { PageParams, PagedResponse } from '@/types/finance.types';
import type { PerfProject } from '@/types/performance.types';
import type { ColumnFilterValue } from '@/types/columnFilter.types';
import { STALE_5MIN, GC_10MIN } from './queryClient';

/** select: rows/total로 정규화 — ViewModel 변환 불필요 */
const selectPerfPage = (raw: PagedResponse<PerfProject>) => ({
  rows:    raw.data,
  total:   raw.total,
  isEmpty: raw.total === 0,
});

export const usePerformanceData = (page: PageParams, progress = '', columnFilters: ColumnFilterValue[] = []) => {
  const selectedParts = usePerfStore(s => s.selectedParts);
  const selectedTeam  = usePerfStore(s => s.selectedTeam);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey:          ['perf-data', selectedParts, selectedTeam, progress, columnFilters, page],
    queryFn:           () => getPerfData(selectedParts, page, selectedTeam, progress, columnFilters),
    select:            selectPerfPage,
    placeholderData:   keepPreviousData,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    retry:             2,
    meta: { queryType: 'perf-data' },
  });

  // 다음 페이지 prefetch — useEffect로 렌더 밖에서 실행
  const { data } = query;
  useEffect(() => {
    if (data && page.page < Math.ceil(data.total / page.pageSize)) {
      const nextPage = { ...page, page: page.page + 1 };
      qc.prefetchQuery({
        queryKey: ['perf-data', selectedParts, selectedTeam, progress, columnFilters, nextPage],
        queryFn:  () => getPerfData(selectedParts, nextPage, selectedTeam, progress, columnFilters),
        staleTime: STALE_5MIN,
      });
    }
  }, [data, page, selectedParts, selectedTeam, progress, columnFilters, qc]);

  return query;
};

export const usePerformanceOptions = () =>
  useQuery({
    queryKey:          ['perf-options'],
    queryFn:           getPerfOptions,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    meta: { queryType: 'perf-options' },
  });
