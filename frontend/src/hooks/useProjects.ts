import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
  const { filters } = useFilters();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['projects', filters, page],
    queryFn:  () => getProjects(filters, page),
    select:   selectProjects,          // 데이터 변환을 쿼리 레이어에서 처리
    placeholderData: keepPreviousData, // 페이지 전환 시 이전 데이터 유지
    structuralSharing: true,           // 동일 참조 유지 → 불필요한 리렌더 방지
    staleTime: STALE_5MIN,
  });

  // 다음 페이지 prefetch — 사용자가 "다음" 클릭하기 전에 미리 캐싱
  const { data } = query;
  if (data && page.page < Math.ceil(data.total / page.pageSize)) {
    const nextPage = { ...page, page: page.page + 1 };
    qc.prefetchQuery({
      queryKey: ['projects', filters, nextPage],
      queryFn:  () => getProjects(filters, nextPage),
      staleTime: STALE_5MIN,
    });
  }

  return query;
};
