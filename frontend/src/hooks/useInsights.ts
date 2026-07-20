import { useQuery } from '@tanstack/react-query';
import { getInsights } from '../api/finance.api';
import { useFilters } from './useFilters';

export const useInsights = () => {
  const { filters } = useFilters();
  return useQuery({
    queryKey: ['insights', filters],
    queryFn: () => getInsights(filters),
  });
};
