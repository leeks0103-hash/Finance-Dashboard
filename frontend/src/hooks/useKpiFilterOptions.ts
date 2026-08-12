import { useQuery } from '@tanstack/react-query';
import { getKpiOptions } from '@/api/kpi.api';
import { STALE_5MIN, GC_10MIN } from './queryClient';

export const useKpiFilterOptions = () =>
  useQuery({
    queryKey:          ['kpi-options'],
    queryFn:           getKpiOptions,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    meta: { queryType: 'kpi-options' },
  });
