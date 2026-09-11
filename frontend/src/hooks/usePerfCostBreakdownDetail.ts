import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getPerfCostBreakdownDetail } from '@/api/performance.api';
import { STALE_5MIN, GC_10MIN } from './queryClient';

/** 원가 비율 확대 모달 — 선택한 파트(비어있으면 인자로 받은 parts 그대로 = 전체/페이지 필터)의 프로젝트별 원가 구성 */
export const usePerfCostBreakdownDetail = (parts: string[], team = '') =>
  useQuery({
    queryKey:          ['perf-costbreakdown-detail', parts, team],
    queryFn:           () => getPerfCostBreakdownDetail(parts, team),
    placeholderData:   keepPreviousData,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    meta: { queryType: 'perf-costbreakdown-detail' },
  });
