import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getKpiSummary, getKpiData } from '@/api/kpi.api';
import { useKpiExcludeStore } from '@/store/kpiExclude.store';
import type { PageParams, Filters } from '@/types/finance.types';
import { STALE_5MIN, GC_10MIN } from './queryClient';

const EMPTY_FILTERS: Filters = { years: [], parts: [], stages: [] };

export const useKpiSummary = (part = '') => {
  // KPI 목표 vs 실적 차트·KPI 집계 표에서 임시로 뺀 프로젝트 — 바뀌면 자동 재조회돼서
  // 체크박스 토글 즉시 집계에 반영됨(서버엔 저장 안 함, 매 요청 파라미터로만 전달)
  const excludedFiles = useKpiExcludeStore(s => s.excludedFiles);
  return useQuery({
    queryKey:          ['kpi-summary', part, excludedFiles],
    queryFn:           () => getKpiSummary(part, excludedFiles),
    // 파트 바꿀 때 이전 데이터를 유지 — 스피너/스텁 페이지 깜빡임 + "전체로 초기화" 방지
    placeholderData:   keepPreviousData,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    retry:             2,
    meta: { queryType: 'kpi-summary' },
  });
};

export const useKpiDataPaged = (page: PageParams, filters: Filters = EMPTY_FILTERS, anomalyOnly = false) =>
  useQuery({
    queryKey:          ['kpi-data-paged', page, filters, anomalyOnly],
    queryFn:           () => getKpiData(filters, page, anomalyOnly),
    select:            (raw) => ({ rows: raw.data, total: raw.total }),
    placeholderData:   keepPreviousData,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    retry:             2,
    meta: { queryType: 'kpi-data-paged' },
  });
