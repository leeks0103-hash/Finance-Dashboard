import { useQueryClient } from '@tanstack/react-query';
import { getSummary, getInsights, getProjects } from '@/api';
import type { Filters } from '@/types';

const DEFAULT_PAGE = { page: 1, pageSize: 30, search: '' };

export const usePrefetch = () => {
  const qc = useQueryClient();

  const prefetch = (filters: Filters) => {
    const opts = { retry: 0, staleTime: 5 * 60_000 };
    qc.prefetchQuery({ queryKey: ['summary',  filters],              queryFn: () => getSummary(filters),                    ...opts });
    qc.prefetchQuery({ queryKey: ['insights', filters],              queryFn: () => getInsights(filters),                   ...opts });
    qc.prefetchQuery({ queryKey: ['projects', filters, DEFAULT_PAGE], queryFn: () => getProjects(filters, DEFAULT_PAGE),    ...opts });
  };

  return { prefetch };
};
