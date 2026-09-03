import type { Filters, PageParams } from '@/types/finance.types';

/** 연도/파트/보고단계 다중선택 필터 — finance·kpi API 공용 (years/parts/stages 구조가 동일) */
export const buildFilterParams = (filters: Filters): URLSearchParams => {
  const params = new URLSearchParams();
  filters.years.forEach(v  => params.append('year',  v));
  filters.parts.forEach(v  => params.append('part',  v));
  filters.stages.forEach(v => params.append('stage', v));
  return params;
};

/** 페이지네이션(page/page_size/search) — 목록 조회 API 공용 */
export const appendPageParams = (params: URLSearchParams, page: PageParams): void => {
  params.set('page',      String(page.page));
  params.set('page_size', String(page.pageSize));
  if (page.search) params.set('search', page.search);
  if (page.field)  params.set('field',  page.field);
};
