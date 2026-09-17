import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProjects } from '@/api';

const ALL_PAGE = { page: 1, pageSize: 9999, search: '' };

const SKIP = new Set(['', '-', 'nan', 'None', 'null']);
// "추가제안"은 로우데이터(재무이력 등)에만 노출되는 임시 보고단계 — 필터 칩 옵션에는 불필요
const STAGE_SKIP = new Set([...SKIP, '추가제안']);

const getUnique = (
  all: { year: string; part: string; stage: string }[],
  key: keyof typeof all[0],
  skip: Set<string> = SKIP,
) =>
  [...new Set(all.map(r => r[key]).filter((v): v is string => v !== null && !skip.has(v)))].sort();

export const useFilterOptions = () => {
  const { data } = useQuery({
    queryKey: ['projects-all'],
    queryFn: () => getProjects({ years: [], parts: [], stages: [] }, ALL_PAGE),
    select:   (raw) => raw.data,
    staleTime: Infinity,
    structuralSharing: true,
    meta: { queryType: 'projects-all' },
  });

  const all = data ?? [];
  return useMemo(() => ({
    years:  getUnique(all, 'year'),
    parts:  getUnique(all, 'part'),
    stages: getUnique(all, 'stage', STAGE_SKIP),
  }), [all]);
};
