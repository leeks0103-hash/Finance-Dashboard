/**
 * 프레임워크 독립적 페이지네이션 코어 — React/Redux/TanStack Query 등 어디에도 의존하지 않는 순수 함수.
 * 이 파일 하나만 그대로 복사해서 다른 프로젝트에 가져다 써도 됨 (import 없음).
 * 상태(PaginationState)는 호출부가 어디에 보관하든 상관없음 — useState, Redux 스토어, Zustand, 평범한 변수 등.
 */

export interface PaginationState {
  /** 1-based 현재 페이지 */
  page:     number;
  pageSize: number;
}

export interface PaginationView extends PaginationState {
  pageCount: number;
  /** 0-based, 서버/배열 슬라이싱에 바로 사용 가능한 시작 인덱스 */
  offset:    number;
  hasPrev:   boolean;
  hasNext:   boolean;
}

export const DEFAULT_PAGE_SIZE = 30;

export const computePageCount = (total: number, pageSize: number): number =>
  pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

export const clampPage = (page: number, pageCount: number): number => {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.trunc(page) : 1;
  return Math.min(safePage, pageCount);
};

export const computeOffset = (page: number, pageSize: number): number =>
  (page - 1) * pageSize;

/** 현재 state + 전체 건수(total)로부터 화면에 필요한 파생값을 계산 (page가 범위를 벗어나면 자동 clamp) */
export const derivePagination = (state: PaginationState, total: number): PaginationView => {
  const pageCount = computePageCount(total, state.pageSize);
  const page = clampPage(state.page, pageCount);
  return {
    page,
    pageSize: state.pageSize,
    pageCount,
    offset: computeOffset(page, state.pageSize),
    hasPrev: page > 1,
    hasNext: page < pageCount,
  };
};

export const createInitialPagination = (pageSize: number = DEFAULT_PAGE_SIZE): PaginationState => ({
  page: 1,
  pageSize,
});

// ── 순수 상태 전이 함수 — Redux reducer, Zustand set(), React setState 어디서든 그대로 사용 ──

export const goToPage = (state: PaginationState, page: number, total: number): PaginationState => ({
  ...state,
  page: clampPage(page, computePageCount(total, state.pageSize)),
});

export const nextPage = (state: PaginationState, total: number): PaginationState =>
  goToPage(state, state.page + 1, total);

export const prevPage = (state: PaginationState, total: number): PaginationState =>
  goToPage(state, state.page - 1, total);

/** 페이지 크기 변경 시 항상 1페이지로 복귀 (기존 목록이 뒤로 밀려 빈 페이지를 보는 것 방지) */
export const changePageSize = (state: PaginationState, pageSize: number): PaginationState => ({
  page: 1,
  pageSize: Number.isFinite(pageSize) && pageSize >= 1 ? Math.trunc(pageSize) : state.pageSize,
});

export const resetToFirstPage = (state: PaginationState): PaginationState => ({
  ...state,
  page: 1,
});
