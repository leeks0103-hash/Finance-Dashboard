import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSummary, getProjects, getInsights } from '@/api/finance.api';
import { getKpiSummary, getKpiData } from '@/api/kpi.api';
import type { Filters } from '@/types/finance.types';
import { STALE_5MIN } from './queryClient';

const DEFAULT_PAGE = { page: 1, pageSize: 30, search: '' };
const EMPTY_FILTERS: Filters = { years: [], parts: [], stages: [] };
const DELAY_MS    = 2_000; // 메인 탭 로드 완료 후 2초 뒤 백그라운드 프리패치

/**
 * 앱 마운트 후 DELAY_MS만큼 기다렸다가 재무(구 탭)·KPI 데이터를 미리 캐싱.
 * 재무현황(실적 데이터)이 랜딩 탭이라 자체 즉시 로드되므로, 보조 탭(재무/KPI)만 백그라운드 프리패치.
 * 사용자가 /finance URL로 직접 진입하거나 KPI 탭 클릭 시 이미 캐시에 있으면 즉시 표시.
 */
export const useBackgroundPrefetch = () => {
  const qc = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => {
      // ── 재무 데이터(구 탭) — queryKey는 createDataHook/useProjects와 동일해야 캐시 히트
      qc.prefetchQuery({
        queryKey: ['summary', EMPTY_FILTERS],
        queryFn:  () => getSummary(EMPTY_FILTERS),
        staleTime: STALE_5MIN,
      });
      qc.prefetchQuery({
        queryKey: ['projects', EMPTY_FILTERS, DEFAULT_PAGE],
        queryFn:  () => getProjects(EMPTY_FILTERS, DEFAULT_PAGE),
        staleTime: STALE_5MIN,
      });
      qc.prefetchQuery({
        queryKey: ['insights', EMPTY_FILTERS],
        queryFn:  () => getInsights(EMPTY_FILTERS),
        staleTime: STALE_5MIN,
      });

      // ── KPI ──────────────────────────────────────────────────
      qc.prefetchQuery({
        queryKey: ['kpi-summary'],
        queryFn:  getKpiSummary,
        staleTime: STALE_5MIN,
      });
      qc.prefetchInfiniteQuery({
        queryKey:         ['kpi-data', { search: '', pageSize: 30 }, EMPTY_FILTERS],
        queryFn:          ({ pageParam }) =>
          getKpiData(EMPTY_FILTERS, { page: pageParam as number, pageSize: 30, search: '' }),
        initialPageParam: 1,
        staleTime:        STALE_5MIN,
      });
    }, DELAY_MS);

    return () => clearTimeout(timer);
  }, [qc]);
};
