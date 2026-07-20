import { useQuery } from '@tanstack/react-query';
import { getProjects } from '@/api';

export const useFilterOptions = () => {
  const { data: all = [] } = useQuery({
    queryKey: ['projects-all'],
    queryFn: () => getProjects({ year: '', parts: [], stages: [] }),
    // staleTime 기본값(3분) 사용 — /api/reload 후 invalidation으로 갱신 가능
  });
  return {
    years:  [...new Set(all.map(r => r.year).filter(Boolean))].sort(),
    parts:  [...new Set(all.map(r => r.part).filter(Boolean))].sort(),
    stages: [...new Set(all.map(r => r.stage).filter(Boolean))].sort(),
  };
};
