import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getPerfInsights } from '@/api/performance.api';
import { usePerfStore } from '@/store/perf.store';

export const usePerformanceInsights = () => {
  const selectedParts = usePerfStore(s => s.selectedParts);
  const selectedTeam  = usePerfStore(s => s.selectedTeam);
  return useQuery({
    queryKey: ['perf-insights', selectedParts, selectedTeam],
    queryFn: () => getPerfInsights(selectedParts, selectedTeam),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
};
