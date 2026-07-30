import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getPerfData, getPerfOptions } from '@/api/performance.api';
import { usePerfStore } from '@/store/perf.store';

export const usePerformanceData = () => {
  const selectedParts = usePerfStore(s => s.selectedParts);
  return useQuery({
    queryKey: ['perf-data', selectedParts],
    queryFn: () => getPerfData(selectedParts),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
};

export const usePerformanceOptions = () =>
  useQuery({
    queryKey: ['perf-options'],
    queryFn: getPerfOptions,
    staleTime: 60_000,
  });
