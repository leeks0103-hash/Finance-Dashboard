import { useQuery } from '@tanstack/react-query';
import { getSummary } from '../api/finance.api';
import { useFilters } from './useFilters';

export const useSummary = () => {
  const { filters } = useFilters();
  return useQuery({
    queryKey: ['summary', filters],
    queryFn: () => getSummary(filters),
  });
};
