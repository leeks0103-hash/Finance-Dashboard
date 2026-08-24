import { describe, it, expect } from 'vitest';
import {
  computePageCount, clampPage, computeOffset, derivePagination,
  createInitialPagination, goToPage, nextPage, prevPage, changePageSize, resetToFirstPage,
} from './core';

describe('computePageCount', () => {
  it('rounds up partial pages', () => {
    expect(computePageCount(101, 30)).toBe(4);
  });

  it('returns 1 for zero total (avoid a 0-page empty state)', () => {
    expect(computePageCount(0, 30)).toBe(1);
  });

  it('returns 1 when pageSize is 0 or negative', () => {
    expect(computePageCount(100, 0)).toBe(1);
    expect(computePageCount(100, -5)).toBe(1);
  });
});

describe('clampPage', () => {
  it('clamps below range up to 1', () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(-3, 5)).toBe(1);
  });

  it('clamps above range down to pageCount', () => {
    expect(clampPage(99, 5)).toBe(5);
  });

  it('truncates non-integer input', () => {
    expect(clampPage(2.9, 5)).toBe(2);
  });

  it('falls back to 1 for non-finite input', () => {
    expect(clampPage(NaN, 5)).toBe(1);
  });
});

describe('computeOffset', () => {
  it('computes 0-based start index', () => {
    expect(computeOffset(1, 30)).toBe(0);
    expect(computeOffset(3, 30)).toBe(60);
  });
});

describe('derivePagination', () => {
  it('derives pageCount/offset/hasPrev/hasNext for a mid-range page', () => {
    const view = derivePagination({ page: 2, pageSize: 10 }, 25);
    expect(view).toMatchObject({ page: 2, pageSize: 10, pageCount: 3, offset: 10, hasPrev: true, hasNext: true });
  });

  it('clamps page down when total shrinks below the stored page', () => {
    // 검색/필터로 total이 줄어서 이전 페이지 번호가 범위를 벗어나는 흔한 시나리오
    const view = derivePagination({ page: 5, pageSize: 10 }, 12);
    expect(view.page).toBe(2);
    expect(view.hasNext).toBe(false);
  });

  it('reports hasPrev/hasNext false on a single-page dataset', () => {
    const view = derivePagination({ page: 1, pageSize: 30 }, 5);
    expect(view.hasPrev).toBe(false);
    expect(view.hasNext).toBe(false);
  });
});

describe('createInitialPagination', () => {
  it('defaults to page 1 with the given page size', () => {
    expect(createInitialPagination(50)).toEqual({ page: 1, pageSize: 50 });
  });

  it('uses DEFAULT_PAGE_SIZE when omitted', () => {
    expect(createInitialPagination().pageSize).toBe(30);
  });
});

describe('goToPage / nextPage / prevPage', () => {
  const state = { page: 2, pageSize: 10 };

  it('goToPage clamps within the valid range', () => {
    expect(goToPage(state, 999, 25)).toEqual({ page: 3, pageSize: 10 });
  });

  it('nextPage advances by one, clamped at the last page', () => {
    expect(nextPage(state, 25)).toEqual({ page: 3, pageSize: 10 });
    expect(nextPage({ page: 3, pageSize: 10 }, 25)).toEqual({ page: 3, pageSize: 10 });
  });

  it('prevPage retreats by one, clamped at page 1', () => {
    expect(prevPage(state, 25)).toEqual({ page: 1, pageSize: 10 });
    expect(prevPage({ page: 1, pageSize: 10 }, 25)).toEqual({ page: 1, pageSize: 10 });
  });
});

describe('changePageSize', () => {
  it('resets to page 1 with the new size', () => {
    expect(changePageSize({ page: 4, pageSize: 10 }, 50)).toEqual({ page: 1, pageSize: 50 });
  });

  it('ignores an invalid size and keeps the previous one', () => {
    expect(changePageSize({ page: 4, pageSize: 10 }, 0)).toEqual({ page: 1, pageSize: 10 });
  });
});

describe('resetToFirstPage', () => {
  it('keeps pageSize and resets page to 1', () => {
    expect(resetToFirstPage({ page: 7, pageSize: 20 })).toEqual({ page: 1, pageSize: 20 });
  });
});
