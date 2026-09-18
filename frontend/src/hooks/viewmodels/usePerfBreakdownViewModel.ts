import { useQuery } from '@tanstack/react-query';
import { getPerfBreakdown } from '@/api/performance.api';
import type { PerfBreakdownChart, PerfBreakdownRow, PerfCalcTerm } from '@/api/performance.api';
import { usePerfStore } from '@/store/perf.store';
import { STALE_5MIN, GC_10MIN } from '@/hooks/queryClient';

export interface PerfBreakdownTarget {
  chart:  PerfBreakdownChart;
  series: number;   // 0 | 1
  key:    string;   // 월 라벨 또는 파트명
  /** true면 페이지 필터(usePerfStore)를 아예 무시 — "전체 평균 원가 비율" 카드는
   *  메인 필터와 무관하게 항상 자기 자신의 팀/파트 선택기 기준으로만 동작해야 해서
   *  (2026-09-18) 이 카드에서 도넛 클릭 시 항상 true로 전달 */
  ignoreMainFilter?: boolean;
  /** ignoreMainFilter일 때만 사용 — 원가 비율 카드에서 골라둔 파트/팀 하나로만 조회.
   *  둘 다 비어있으면 "전체" 기준(카드 도넛과 동일 범위) */
  partOverride?: string;
  teamOverride?: string;
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
  const storeParts = usePerfStore(s => s.selectedParts);
  const storeTeam  = usePerfStore(s => s.selectedTeam);
  const parts = target?.ignoreMainFilter
    ? (target.partOverride ? [target.partOverride] : [])
    : storeParts;
  const team = target?.ignoreMainFilter
    ? (target.teamOverride ?? '')
    : storeTeam;

  const { data, isLoading, isError } = useQuery({
    queryKey:  ['perf-breakdown', target, parts, team],
    queryFn:   () => getPerfBreakdown(target!.chart, target!.series, target!.key, parts, team),
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
