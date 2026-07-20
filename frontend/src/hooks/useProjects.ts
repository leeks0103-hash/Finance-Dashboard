import { useSuspenseQuery } from '@tanstack/react-query';
import { getProjects } from '@/api';
import { useFilters } from './useFilters';

export const useProjects = () => {
  const { filters } = useFilters();
  return useSuspenseQuery({
    queryKey: ['projects', filters],
    queryFn: () => getProjects(filters),
  });
};
