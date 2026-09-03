import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReactPagination } from './useReactPagination';

describe('useReactPagination', () => {
  it('starts at page 1 with the given page size', () => {
    const { result } = renderHook(() => useReactPagination(20));
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(20);
  });

  it('defaults to DEFAULT_PAGE_SIZE when no initial size is given', () => {
    const { result } = renderHook(() => useReactPagination());
    expect(result.current.pageSize).toBe(30);
  });

  it('setPage moves to any page when no total is given (caller already validated the range)', () => {
    const { result } = renderHook(() => useReactPagination(10));

    act(() => result.current.setPage(5));
    expect(result.current.page).toBe(5);
  });

  it('setPage clamps against total when provided', () => {
    const { result } = renderHook(() => useReactPagination(10));

    act(() => result.current.setPage(999, 25)); // 25건/10개씩 = 3페이지가 최대
    expect(result.current.page).toBe(3);
  });

  it('next/prev move by one and stop at the edges (bound checked against total passed per-call)', () => {
    const { result } = renderHook(() => useReactPagination(10));
    const total = 25; // 3페이지

    act(() => result.current.next(total));
    expect(result.current.page).toBe(2);

    act(() => result.current.next(total));
    act(() => result.current.next(total)); // 이미 마지막 페이지 — 더 안 넘어감
    expect(result.current.page).toBe(3);

    act(() => result.current.prev(total));
    expect(result.current.page).toBe(2);
  });

  it('setPageSize resets to page 1', () => {
    const { result } = renderHook(() => useReactPagination(10));

    act(() => result.current.setPage(5));
    expect(result.current.page).toBe(5);

    act(() => result.current.setPageSize(50));
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(50);
  });

  it('resetToFirstPage keeps pageSize', () => {
    const { result } = renderHook(() => useReactPagination(10));

    act(() => result.current.setPage(4));
    act(() => result.current.resetToFirstPage());

    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(10);
  });

  it('does not require total up front — total only matters when actually bounding a move', () => {
    // 이 훅은 total(전체 건수)을 생성 시점이 아니라 각 액션 호출 시점에 받는다 —
    // total은 보통 이 상태를 사용하는 쿼리의 "결과"로만 알 수 있어서, 쿼리가 page/pageSize를
    // 필요로 하는 시점보다 항상 늦게 등장하기 때문. 생성자에 total을 요구하면 순환 의존이 생김.
    const { result } = renderHook(() => useReactPagination(10));
    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(10);
  });
});
