import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getPerfSummary } from '@/api/performance.api';
import { usePerfStore } from '@/store/perf.store';
import { STALE_5MIN, GC_10MIN } from './queryClient';

export const usePerformanceSummary = () => {
  const selectedParts = usePerfStore(s => s.selectedParts);
  const selectedTeam  = usePerfStore(s => s.selectedTeam);
  return useQuery({
    queryKey:          ['perf-summary', selectedParts, selectedTeam],
    queryFn:           () => getPerfSummary(selectedParts, selectedTeam),
    placeholderData:   keepPreviousData,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    retry:             2,
    meta: { queryType: 'perf-summary' },
  });
};
