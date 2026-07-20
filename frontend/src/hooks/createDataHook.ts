import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { Filters } from '@/types';
import { useFilters } from './useFilters';

type QueryFn<T> = (filters: Filters) => Promise<T>;

export const createDataHook = <T>(key: string, queryFn: QueryFn<T>) =>
  () => {
    const { filters } = useFilters();
    return useQuery({
      queryKey: [key, filters],
      queryFn: () => queryFn(filters),
      placeholderData: keepPreviousData,
    });
  };
