import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getPerfSummary, getPerfData } from '@/api/performance.api';
import { getKpiSummary, getKpiData } from '@/api/kpi.api';

const STALE_5MIN  = 5 * 60_000;
const DEFAULT_PAGE = { page: 1, pageSize: 30, search: '' };
const DELAY_MS    = 2_000; // 메인 탭 로드 완료 후 2초 뒤 백그라운드 프리패치

/**
 * 앱 마운트 후 DELAY_MS만큼 기다렸다가 실적·KPI 탭 데이터를 미리 캐싱.
 * 사용자가 탭 클릭 시 이미 캐시에 있으면 즉시 표시 → 초기 렉 제거.
 */
export const useBackgroundPrefetch = () => {
  const qc = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => {
      // ── 실적 현황 ────────────────────────────────────────────
      qc.prefetchQuery({
        queryKey: ['perf-summary', []],
        queryFn:  () => getPerfSummary([]),
        staleTime: STALE_5MIN,
      });
      qc.prefetchQuery({
        queryKey: ['perf-data', [], DEFAULT_PAGE],
        queryFn:  () => getPerfData([], DEFAULT_PAGE),
        staleTime: STALE_5MIN,
      });
      qc.prefetchQuery({
        queryKey: ['perf-options'],
        queryFn:  () => import('@/api/performance.api').then(m => m.getPerfOptions()),
        staleTime: STALE_5MIN,
      });

      // ── KPI ──────────────────────────────────────────────────
      qc.prefetchQuery({
        queryKey: ['kpi-summary'],
        queryFn:  getKpiSummary,
        staleTime: STALE_5MIN,
      });
      qc.prefetchInfiniteQuery({
        queryKey:         ['kpi-data', { search: '', pageSize: 30 }],
        queryFn:          ({ pageParam }) =>
          getKpiData({ page: pageParam as number, pageSize: 30, search: '' }),
        initialPageParam: 1,
        staleTime:        STALE_5MIN,
      });
    }, DELAY_MS);

    return () => clearTimeout(timer);
  }, [qc]);
};
