import { useCallback, useState } from 'react';
import {
  createInitialPagination,
  goToPage, nextPage, prevPage, changePageSize, resetToFirstPage as resetState,
  type PaginationState,
} from './core';

export interface UseReactPaginationResult extends PaginationState {
  /** total 생략 시 상한 없이 이동(호출부가 이미 유효 범위만 넘긴다고 보장하는 경우, 예: Pagination UI) */
  setPage:          (page: number, total?: number) => void;
  setPageSize:      (pageSize: number) => void;
  resetToFirstPage: () => void;
  next:             (total: number) => void;
  prev:             (total: number) => void;
}

/**
 * pagination core를 React useState로 감싈 얇은 어댑터.
 * total(전체 건수)은 대개 이 상태를 쓰는 쪽의 데이터 쿼리 *결과*로만 알 수 있어서 — 즉 쿼리가
 * page/pageSize를 필요로 하는 시점보다 항상 늦게 등장함 — 훅 생성 시점이 아니라 각 액션 호출
 * 시점에 인자로 받는다. 그래야 "total을 얻으려면 쿼리를 먼저 돌려야 하고, 쿼리를 돌리려면
 * page/pageSize가 먼저 있어야 한다"는 순환을 피할 수 있음.
 * Redux/Zustand 등 다른 상태관리를 쓰는 프로젝트는 이 파일 대신 core.ts 위에 자체 어댑터만
 * 짧게 작성하면 됨 — 계산 로직(core.ts)은 그대로 재사용.
 */
export const useReactPagination = (initialPageSize?: number): UseReactPaginationResult => {
  const [state, setState] = useState<PaginationState>(() => createInitialPagination(initialPageSize));

  return {
    ...state,
    setPage: useCallback((page: number, total = Infinity) => {
      setState(s => goToPage(s, page, total));
    }, []),
    setPageSize:      useCallback((pageSize: number) => setState(s => changePageSize(s, pageSize)), []),
    resetToFirstPage: useCallback(() => setState(resetState), []),
    next:             useCallback((total: number) => setState(s => nextPage(s, total)), []),
    prev:             useCallback((total: number) => setState(s => prevPage(s, total)), []),
  };
};
