import { useQuery } from '@tanstack/react-query';
import { getProjects } from '../api/finance.api';
import { useFilters } from './useFilters';

export const useProjects = () => {
  const { filters } = useFilters();
  return useQuery({
    queryKey: ['projects', filters],
    queryFn: () => getProjects(filters),
  });
};
