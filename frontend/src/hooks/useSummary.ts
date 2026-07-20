import { useSuspenseQuery } from '@tanstack/react-query';
import { getSummary } from '@/api';
import { useFilters } from './useFilters';

export const useSummary = () => {
  const { filters } = useFilters();
  return useSuspenseQuery({
    queryKey: ['summary', filters],
    queryFn: () => getSummary(filters),
  });
};
