import { useQuery } from '@tanstack/react-query';
import { getFinanceBreakdown } from '@/api/finance.api';
import type { FinanceBreakdownRow } from '@/api/finance.api';
import { useFilterStore } from '@/store/filter.store';
import { STALE_5MIN, GC_10MIN } from '@/hooks/queryClient';

export interface FinanceBreakdownTarget {
  field: string;             // revenue | expenditure | operating_profit | profit_rate | direct_cost | labor_cost | overhead
  dim:   'part' | 'stage' | '';
  key:   string;             // 파트명·보고단계 라벨 (dim이 ''면 무시)
}

export interface FinanceBreakdownViewModel {
  isLoading: boolean;
  isError:   boolean;
  available: boolean;
  message?:  string;
  dimLabel:  string;   // '파트' | '보고단계' | '전체'
  keyLabel:  string;
  fieldLabel: string;
  unit:      string;
  rows:      FinanceBreakdownRow[];
  count:     number;
  totalStr:  string;
}

const fmt = (v: number): string =>
  Number.isInteger(v) ? v.toLocaleString() : String(Number(v.toFixed(1)));

export const useFinanceBreakdownViewModel = (
  target: FinanceBreakdownTarget | null,
): FinanceBreakdownViewModel => {
  const years  = useFilterStore(s => s.years);
  const parts  = useFilterStore(s => s.parts);
  const stages = useFilterStore(s => s.stages);

  const { data, isLoading, isError } = useQuery({
    queryKey:  ['finance-breakdown', target, years, parts, stages],
    queryFn:   () => getFinanceBreakdown({ years, parts, stages }, target!.field, target!.dim, target!.key),
    enabled:   !!target,
    staleTime: STALE_5MIN,
    gcTime:    GC_10MIN,
  });

  const rows  = data?.rows ?? [];
  const total = data?.total ?? 0;

  return {
    isLoading,
    isError,
    available:  data?.available ?? false,
    message:    data?.message,
    dimLabel:   data?.dim === 'part' ? '파트' : data?.dim === 'stage' ? '보고단계' : '전체',
    keyLabel:   data?.key || target?.key || '',
    fieldLabel: data?.label ?? '',
    unit:       data?.unit ?? '',
    rows,
    count:      data?.count ?? rows.length,
    totalStr:   fmt(total),
  };
};
