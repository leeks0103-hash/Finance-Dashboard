import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getKpiSummary, getKpiData } from '@/api/kpi.api';
import type { PageParams, Filters } from '@/types/finance.types';
import { STALE_5MIN, GC_10MIN } from './queryClient';

const EMPTY_FILTERS: Filters = { years: [], parts: [], stages: [] };

export const useKpiSummary = (part = '') =>
  useQuery({
    queryKey:          ['kpi-summary', part],
    queryFn:           () => getKpiSummary(part),
    // 파트 바꿀 때 이전 데이터를 유지 — 스피너/스텁 페이지 깜빡임 + "전체로 초기화" 방지
    placeholderData:   keepPreviousData,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    retry:             2,
    meta: { queryType: 'kpi-summary' },
  });

export const useKpiDataPaged = (page: PageParams, filters: Filters = EMPTY_FILTERS) =>
  useQuery({
    queryKey:          ['kpi-data-paged', page, filters],
    queryFn:           () => getKpiData(filters, page),
    select:            (raw) => ({ rows: raw.data, total: raw.total }),
    placeholderData:   keepPreviousData,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    retry:             2,
    meta: { queryType: 'kpi-data-paged' },
  });
