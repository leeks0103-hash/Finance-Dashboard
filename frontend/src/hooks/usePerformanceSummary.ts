import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getPerfSummary } from '@/api/performance.api';
import { usePerfStore } from '@/store/perf.store';

export const usePerformanceSummary = () => {
  const selectedParts = usePerfStore(s => s.selectedParts);
  return useQuery({
    queryKey: ['perf-summary', selectedParts],
    queryFn: () => getPerfSummary(selectedParts),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
};
