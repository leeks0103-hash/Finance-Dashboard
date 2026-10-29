import { useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { getPerfPlanSummary, getPerfData } from '@/api/performance.api';
import { usePerfStore } from '@/store/perf.store';
import type { PageParams, PagedResponse } from '@/types/finance.types';
import type { PerfProject } from '@/types/performance.types';
import type { ColumnFilterValue } from '@/types/columnFilter.types';
import { STALE_5MIN, GC_10MIN } from './queryClient';

/** 2027 사업계획 보기 요약(2026-10-29) — 실적 요약(usePerformanceSummary)과 키·응답이 따로라 서로 캐시를 안 섞음 */
export const usePerformancePlanSummary = () => {
  const selectedParts = usePerfStore(s => s.selectedParts);
  const selectedTeam  = usePerfStore(s => s.selectedTeam);
  return useQuery({
    queryKey:          ['perf-plan-summary', selectedParts, selectedTeam],
    queryFn:           () => getPerfPlanSummary(selectedParts, selectedTeam),
    placeholderData:   keepPreviousData,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    retry:             2,
    meta: { queryType: 'perf-plan-summary' },
  });
};

const selectPage = (raw: PagedResponse<PerfProject>) => ({ rows: raw.data, total: raw.total, isEmpty: raw.total === 0 });

/** 2027 사업계획 보기 프로젝트 상세 — 실적 표(usePerformanceData)와 같은 서버 페이지·정렬·검색, 키만 따로 */
export const usePerformancePlanData = (page: PageParams, progress = '', columnFilters: ColumnFilterValue[] = []) => {
  const selectedParts = usePerfStore(s => s.selectedParts);
  const selectedTeam  = usePerfStore(s => s.selectedTeam);
  const qc = useQueryClient();
  const fetchPage = (p: PageParams) => getPerfData(selectedParts, p, selectedTeam, progress, columnFilters, 'plan27');

  const query = useQuery({
    queryKey:          ['perf-plan-data', selectedParts, selectedTeam, progress, columnFilters, page],
    queryFn:           () => fetchPage(page),
    select:            selectPage,
    placeholderData:   keepPreviousData,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    retry:             2,
    meta: { queryType: 'perf-plan-data' },
  });

  const { data } = query;
  useEffect(() => {
    if (data && page.page < Math.ceil(data.total / page.pageSize)) {
      const next = { ...page, page: page.page + 1 };
      qc.prefetchQuery({
        queryKey: ['perf-plan-data', selectedParts, selectedTeam, progress, columnFilters, next],
        queryFn:  () => fetchPage(next),
        staleTime: STALE_5MIN,
      });
    }
  }, [data, page, selectedParts, selectedTeam, progress, columnFilters, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  return query;
};
