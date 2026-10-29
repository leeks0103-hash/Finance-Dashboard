import { useQuery } from '@tanstack/react-query';
import { getPerfViews } from '@/api/performance.api';
import { STALE_5MIN, GC_10MIN } from './queryClient';

/** 전환 가능한 뷰(2026 실적 / 2027 계획) — 계획 시트가 없는 파일이면 plan27.available=false라 전환 칩이 안 보임(2026-10-29) */
export const usePerfViews = () =>
  useQuery({
    queryKey:          ['perf-views'],
    queryFn:           getPerfViews,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    meta: { queryType: 'perf-views' },
  });
