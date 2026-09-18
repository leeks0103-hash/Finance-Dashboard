import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getPerfSummary } from '@/api/performance.api';
import { STALE_5MIN, GC_10MIN } from './queryClient';

/**
 * "전체 평균 원가 비율" 카드 전용 — 메인 필터(파트/팀 칩) 선택과 무관하게 항상 전체
 * 데이터 기준으로 계산. 이 카드는 자기 자신의 팀/파트 선택기(CostFilterPopover)가
 * 따로 있어서, 메인 필터를 걸어도 이 카드 값이 같이 바뀌면 안 된다는 요청(2026-09-18).
 */
export const usePerformanceSummaryAll = () =>
  useQuery({
    queryKey:          ['perf-summary', [], ''],
    queryFn:           () => getPerfSummary([], ''),
    placeholderData:   keepPreviousData,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    retry:             2,
    meta: { queryType: 'perf-summary' },
  });
