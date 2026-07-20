import { useQueryClient } from '@tanstack/react-query';
import { getSummary, getInsights, getProjects } from '@/api';
import type { Filters } from '@/types';

export const usePrefetch = () => {
  const qc = useQueryClient();

  const prefetch = (filters: Filters) => {
    // H-8: retry:0 — prefetch 실패 시 에러 캐시 생성 방지
    const opts = { retry: 0, staleTime: 3 * 60 * 1000 };
    qc.prefetchQuery({ queryKey: ['summary',  filters], queryFn: () => getSummary(filters),  ...opts });
    qc.prefetchQuery({ queryKey: ['insights', filters], queryFn: () => getInsights(filters), ...opts });
    qc.prefetchQuery({ queryKey: ['projects', filters], queryFn: () => getProjects(filters),  ...opts });
  };

  return { prefetch };
};
