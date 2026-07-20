import { useQueryClient } from '@tanstack/react-query';
import { getSummary, getInsights, getProjects } from '@/api';
import type { Filters } from '@/types';

export const usePrefetch = () => {
  const qc = useQueryClient();

  const prefetch = (filters: Filters) => {
    qc.prefetchQuery({ queryKey: ['summary',  filters], queryFn: () => getSummary(filters)  });
    qc.prefetchQuery({ queryKey: ['insights', filters], queryFn: () => getInsights(filters) });
    qc.prefetchQuery({ queryKey: ['projects', filters], queryFn: () => getProjects(filters)  });
  };

  return { prefetch };
};
