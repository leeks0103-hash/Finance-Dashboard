import { useQuery } from '@tanstack/react-query';
import { getPerfBreakdown } from '@/api/performance.api';
import type { PerfBreakdownChart, PerfBreakdownRow, PerfCalcTerm } from '@/api/performance.api';
import { usePerfStore } from '@/store/perf.store';
import { STALE_5MIN, GC_10MIN } from '@/hooks/queryClient';

export interface PerfBreakdownTarget {
  chart:  PerfBreakdownChart;
  series: number;   // 0 | 1
  key:    string;   // 월 라벨 또는 파트명
  /** 페이지 필터(usePerfStore) 대신 이 파트 하나로만 조회 — 원가 비율 모달에서
   *  카드로 파트를 골라둔 상태에서 도넛을 클릭했을 때 그 파트 기준으로 보여주기 위함 */
  partOverride?: string;
}

export interface PerfBreakdownViewModel {
  isLoading:   boolean;
  isError:     boolean;
  available:   boolean;
  message?:    string;
  seriesLabel: string;
  dimLabel:    string;          // '월' | '파트'
  keyLabel:    string;
  fieldDesc:   string;          // 이 막대가 쓰는 엑셀 열 설명
  aggDesc:     string;          // 집계 방식 설명
  glossary:    PerfCalcTerm[];  // 파생 값 계산식
  rows:        PerfBreakdownRow[];
  count:       number;
  totalStr:    string;
  unit:        string;
}

const fmt = (v: number): string =>
  Number.isInteger(v) ? v.toLocaleString() : String(Number(v.toFixed(1)));

export const usePerfBreakdownViewModel = (
  target: PerfBreakdownTarget | null,
): PerfBreakdownViewModel => {
  const selectedParts = usePerfStore(s => s.selectedParts);
  const selectedTeam  = usePerfStore(s => s.selectedTeam);
  const parts = target?.partOverride ? [target.partOverride] : selectedParts;

  const { data, isLoading, isError } = useQuery({
    queryKey:  ['perf-breakdown', target, parts, selectedTeam],
    queryFn:   () => getPerfBreakdown(target!.chart, target!.series, target!.key, parts, selectedTeam),
    enabled:   !!target,
    staleTime: STALE_5MIN,
    gcTime:    GC_10MIN,
  });

  const rows  = data?.rows ?? [];
  const total = data?.total ?? 0;

  return {
    isLoading,
    isError,
    available:   data?.available ?? false,
    message:     data?.message,
    seriesLabel: data?.series_label ?? '',
    dimLabel:    data?.dim === 'month' ? '월' : data?.dim === 'part' ? '파트' : '원가 항목',
    keyLabel:    data?.key ?? target?.key ?? '',
    fieldDesc:   data?.field_desc ?? '',
    aggDesc:     data?.agg_desc ?? '',
    glossary:    data?.glossary ?? [],
    rows,
    count:       data?.count ?? rows.length,
    totalStr:    fmt(total),
    unit:        data?.unit ?? '억',
  };
};
