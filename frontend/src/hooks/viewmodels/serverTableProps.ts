import type { UseReactPaginationResult } from '@/lib/pagination';
import type { DebouncedSearch } from '@/hooks/useDebouncedSearch';

/**
 * 서버 페이지 표(DataTable 등)에 넘기는 serverPagination / serverSearch 묶음 만들기 — 실적·실적 계획·재무 상세·KPI
 * 뷰모델 네 곳에 같은 코드가 있던 것을 한 곳으로(2026-10-30). 반환 모양은 DataTable의 ServerPagination / ServerSearch와 같음
 * (뷰모델은 컴포넌트를 import하지 않으므로 타입은 구조로만 맞춤)
 */
export const buildServerPagination = (pagination: UseReactPaginationResult, total: number) => ({
  total,
  page:             pagination.page,
  pageSize:         pagination.pageSize,
  onPageChange:     pagination.setPage,
  onPageSizeChange: pagination.setPageSize,
});

/** 검색어를 바꾸면 1페이지로, 검색 범위(field)를 바꿔도 1페이지로 */
export const buildServerSearch = (
  search: DebouncedSearch,
  pagination: UseReactPaginationResult,
  field: string,
  setField: (field: string) => void,
  fieldOptions: { value: string; label: string }[],
) => ({
  value:    search.inputValue,
  onChange: (val: string) => {
    search.handleChange({ target: { value: val } } as React.ChangeEvent<HTMLInputElement>);
    pagination.resetToFirstPage();
  },
  field,
  onFieldChange: (f: string) => { setField(f); pagination.resetToFirstPage(); },
  fieldOptions,
});
