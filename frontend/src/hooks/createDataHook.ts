import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { Filters } from '@/types';
import { useFilters } from './useFilters';
import { STALE_5MIN, GC_10MIN } from './queryClient';

type QueryFn<T> = (filters: Filters) => Promise<T>;

/**
 * 필터 기반 단순 조회 훅 팩토리.
 * - staleTime 5분 / gcTime 10분 — 탭 전환 시 불필요한 refetch 방지
 * - keepPreviousData — 필터 변경 시 이전 데이터 유지 (깜박임 방지)
 * - structuralSharing — 동일 값이면 참조 유지 → 불필요한 리렌더 방지
 * - meta — 전역 에러 핸들러에서 queryType 식별용
 */
export const createDataHook = <T>(
  key: string,
  queryFn: QueryFn<T>,
  meta?: Record<string, unknown>,
) =>
  () => {
    const { filters } = useFilters();
    return useQuery({
      queryKey:          [key, filters],
      queryFn:           () => queryFn(filters),
      placeholderData:   keepPreviousData,
      structuralSharing: true,
      staleTime:         STALE_5MIN,
      gcTime:            GC_10MIN,
      retry:             2,
      meta: { queryType: key, ...meta },
    });
  };
