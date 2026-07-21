import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProjects } from '@/api';

const getUnique = (all: { year: string; part: string; stage: string }[], key: keyof typeof all[0]) =>
  [...new Set(all.map(r => r[key]).filter((v): v is string => v !== null && v !== ''))].sort();

export const useFilterOptions = () => {
  const { data: all = [] } = useQuery({
    queryKey: ['projects-all'],
    queryFn: () => getProjects({ year: '', parts: [], stages: [] }),
    staleTime: Infinity,  // reload 시에만 invalidate — 자동 refetch 없음
  });

  // M-8: useMemo로 렌더마다 반복 계산 방지
  return useMemo(() => ({
    years:  getUnique(all, 'year'),
    parts:  getUnique(all, 'part'),
    stages: getUnique(all, 'stage'),
  }), [all]);
};
