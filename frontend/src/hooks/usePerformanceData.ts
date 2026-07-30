import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { getPerfData, getPerfOptions } from '@/api/performance.api';
import { usePerfStore } from '@/store/perf.store';
import type { PageParams, PagedResponse } from '@/types/finance.types';
import type { PerfProject } from '@/types/performance.types';

const STALE_5MIN = 5 * 60_000;
const GC_10MIN   = 10 * 60_000;

/** select: rows/total로 정규화 — ViewModel 변환 불필요 */
const selectPerfPage = (raw: PagedResponse<PerfProject>) => ({
  rows:    raw.data,
  total:   raw.total,
  isEmpty: raw.total === 0,
});

export const usePerformanceData = (page: PageParams) => {
  const selectedParts = usePerfStore(s => s.selectedParts);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey:          ['perf-data', selectedParts, page],
    queryFn:           () => getPerfData(selectedParts, page),
    select:            selectPerfPage,
    placeholderData:   keepPreviousData,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    retry:             2,
    meta: { queryType: 'perf-data' },
  });

  // 다음 페이지 prefetch
  const { data } = query;
  if (data && page.page < Math.ceil(data.total / page.pageSize)) {
    const nextPage = { ...page, page: page.page + 1 };
    qc.prefetchQuery({
      queryKey: ['perf-data', selectedParts, nextPage],
      queryFn:  () => getPerfData(selectedParts, nextPage),
      staleTime: STALE_5MIN,
    });
  }

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
