import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProjects } from '@/api';

const ALL_PAGE = { page: 1, pageSize: 9999, search: '' };

const getUnique = (all: { year: string; part: string; stage: string }[], key: keyof typeof all[0]) =>
  [...new Set(all.map(r => r[key]).filter((v): v is string => v !== null && v !== ''))].sort();

export const useFilterOptions = () => {
  const { data } = useQuery({
    queryKey: ['projects-all'],
    queryFn: () => getProjects({ year: '', parts: [], stages: [] }, ALL_PAGE),
    select:   (raw) => raw.data,
    staleTime: Infinity,
    structuralSharing: true,
    meta: { queryType: 'projects-all' },
  });

  const all = data ?? [];
  return useMemo(() => ({
    years:  getUnique(all, 'year'),
    parts:  getUnique(all, 'part'),
    stages: getUnique(all, 'stage'),
  }), [all]);
};
