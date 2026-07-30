import { useQuery, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { getKpiSummary, getKpiData } from '@/api/kpi.api';
import type { PageParams } from '@/types/finance.types';

const STALE_5MIN = 5 * 60_000;
const GC_10MIN   = 10 * 60_000;

export const useKpiSummary = () =>
  useQuery({
    queryKey:          ['kpi-summary'],
    queryFn:           getKpiSummary,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    retry:             2,
    meta: { queryType: 'kpi-summary' },
  });

/**
 * KPI 취합 로우데이터 — useInfiniteQuery 기반
 * - fetchNextPage()로 다음 페이지를 누적 로드 ("더 보기" 버튼 방식)
 * - select: 모든 페이지를 단일 rows 배열로 평탄화
 * - 기존 useKpiData(PageParams) 대신 사용
 */
export const useKpiData = (search = '', pageSize = 30) =>
  useInfiniteQuery({
    queryKey:   ['kpi-data', { search, pageSize }],
    queryFn:    ({ pageParam }) =>
      getKpiData({ page: pageParam as number, pageSize, search }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const fetched = allPages.reduce((sum, p) => sum + p.data.length, 0);
      return fetched < lastPage.total ? allPages.length + 1 : undefined;
    },
    select: (data) => ({
      rows:  data.pages.flatMap(p => p.data),
      total: data.pages[0]?.total ?? 0,
    }),
    placeholderData:   keepPreviousData,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    retry:             2,
    meta: { queryType: 'kpi-data' },
  });

/** 기존 페이지 방식 유지 (하위 호환) */
export const useKpiDataPaged = (page: PageParams) =>
  useQuery({
    queryKey:          ['kpi-data-paged', page],
    queryFn:           () => getKpiData(page),
    select:            (raw) => ({ rows: raw.data, total: raw.total }),
    placeholderData:   keepPreviousData,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    retry:             2,
    meta: { queryType: 'kpi-data-paged' },
  });
