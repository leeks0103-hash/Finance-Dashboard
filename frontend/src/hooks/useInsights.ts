import { useSuspenseQuery } from '@tanstack/react-query';
import { getInsights } from '@/api';
import { useFilters } from './useFilters';

export const useInsights = () => {
  const { filters } = useFilters();
  return useSuspenseQuery({
    queryKey: ['insights', filters],
    queryFn: () => getInsights(filters),
  });
};
