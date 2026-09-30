import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { getProjects } from '@/api';
import { useFilters } from './useFilters';
import type { PageParams, PagedResponse, Project } from '@/types/finance.types';
import { STALE_5MIN } from './queryClient';

/** select: 응답 형태를 rows/total로 정규화 — ViewModel에서 별도 변환 불필요 */
const selectProjects = (raw: PagedResponse<Project>) => ({
  rows:    raw.data,
  total:   raw.total,
  isEmpty: raw.total === 0,
});

export const useProjects = (page: PageParams) => {
  const { filters: globalFilters } = useFilters();
  // 표의 셀렉트(보고단계 / 팀·파트)가 켜져 있으면 전역 필터의 해당 항목을 그 값으로 바꿔서 조회
  // (정확히 일치 — 검색어 방식이면 "제안"에 "추가제안"까지 걸림)
  const filters = useMemo(
    () => (page.stage || page.parts
      ? {
          ...globalFilters,
          ...(page.stage ? { stages: [page.stage] } : {}),
          ...(page.parts ? { parts: page.parts } : {}),
        }
      : globalFilters),
    [globalFilters, page.stage, page.parts],
  );
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['projects', filters, page],
    queryFn:  () => getProjects(filters, page),
    select:   selectProjects,          // 데이터 변환을 쿼리 레이어에서 처리
    placeholderData: keepPreviousData, // 페이지 전환 시 이전 데이터 유지
    structuralSharing: true,           // 동일 참조 유지 → 불필요한 리렌더 방지
    staleTime: STALE_5MIN,
  });

  // 다음 페이지 prefetch — useEffect로 렌더 밖에서 실행
  const { data } = query;
  useEffect(() => {
    if (data && page.page < Math.ceil(data.total / page.pageSize)) {
      const nextPage = { ...page, page: page.page + 1 };
      qc.prefetchQuery({
        queryKey: ['projects', filters, nextPage],
        queryFn:  () => getProjects(filters, nextPage),
        staleTime: STALE_5MIN,
      });
    }
  }, [data, page, filters, qc]);

  return query;
};
