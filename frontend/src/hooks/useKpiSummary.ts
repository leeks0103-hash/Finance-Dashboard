import { useQuery } from '@tanstack/react-query';
import { getKpiSummary, getKpiData } from '@/api/kpi.api';

export const useKpiSummary = () =>
  useQuery({
    queryKey: ['kpi-summary'],
    queryFn:  getKpiSummary,
    staleTime: 30_000,
  });

export const useKpiData = () =>
  useQuery({
    queryKey: ['kpi-data'],
    queryFn:  getKpiData,
    staleTime: 30_000,
  });
