import { useQuery } from '@tanstack/react-query';
import { getKpiOptions } from '@/api/kpi.api';

const STALE_5MIN = 5 * 60_000;
const GC_10MIN   = 10 * 60_000;

export const useKpiFilterOptions = () =>
  useQuery({
    queryKey:          ['kpi-options'],
    queryFn:           getKpiOptions,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    meta: { queryType: 'kpi-options' },
  });
