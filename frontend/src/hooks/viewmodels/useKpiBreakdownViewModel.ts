import { useQuery } from '@tanstack/react-query';
import { getKpiBreakdown } from '@/api/kpi.api';
import { useKpiExcludeStore } from '@/store/kpiExclude.store';
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
  /** 임시 제외 — 체크박스 클릭 시 이 프로젝트(파일명)를 목표vs실적 차트·KPI 집계·이 모달의
   *  합계에서 즉시 뺐다 넣었다 할 수 있음(서버 저장 없음, 새로고침하면 초기화) */
  excludedFiles:  string[];
  toggleExclude:  (file: string) => void;
}

const fmt = (v: number): string =>
  Number.isInteger(v) ? v.toLocaleString() : String(Number(v.toFixed(2)));

export const useKpiBreakdownViewModel = (
  name: string | null,
  metric: 'target' | 'actual' | 'prev',
): KpiBreakdownViewModel => {
  const excludedFiles  = useKpiExcludeStore(s => s.excludedFiles);
  const toggleExclude  = useKpiExcludeStore(s => s.toggleExclude);

  const { data, isLoading, isError } = useQuery({
    queryKey:  ['kpi-breakdown', name, metric, excludedFiles],
    queryFn:   () => getKpiBreakdown(name as string, metric, excludedFiles),
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
    excludedFiles,
    toggleExclude,
  };
};
