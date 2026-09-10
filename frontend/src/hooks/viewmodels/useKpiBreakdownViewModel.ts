import { useQuery } from '@tanstack/react-query';
import { getKpiBreakdown } from '@/api/kpi.api';
import type { KpiBreakdownRow } from '@/api/kpi.api';
import { STALE_5MIN, GC_10MIN } from '@/hooks/queryClient';

export interface KpiBreakdownViewModel {
  isLoading:   boolean;
  isError:     boolean;
  available:   boolean;
  message?:    string;
  name:        string;
  metricLabel: string;
  aggLabel:    string;          // '합계' | '평균'
  column:      string;
  note:        string;
  rows:        KpiBreakdownRow[];
  count:       number;
  totalStr:    string;
}

const fmt = (v: number): string =>
  Number.isInteger(v) ? v.toLocaleString() : String(Number(v.toFixed(2)));

export const useKpiBreakdownViewModel = (
  name: string | null,
  metric: 'target' | 'actual',
): KpiBreakdownViewModel => {
  const { data, isLoading, isError } = useQuery({
    queryKey:  ['kpi-breakdown', name, metric],
    queryFn:   () => getKpiBreakdown(name as string, metric),
    enabled:   !!name,
    staleTime: STALE_5MIN,
    gcTime:    GC_10MIN,
  });

  const rows  = data?.rows ?? [];
  const agg   = data?.agg ?? 'sum';
  const total = data?.total ?? 0;

  return {
    isLoading,
    isError,
    available:   data?.available ?? false,
    message:     data?.message,
    name:        data?.name ?? name ?? '',
    metricLabel: data?.metric_label ?? '',
    aggLabel:    agg === 'avg' ? '평균' : '합계',
    column:      data?.column ?? '',
    note:        data?.note ?? '',
    rows,
    count:       data?.count ?? rows.length,
    totalStr:    fmt(total),
  };
};
