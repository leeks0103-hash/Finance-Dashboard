import { useCallback, useState } from 'react';

export interface ServerSortState {
  sortBy:  string | null;
  sortDir: 'asc' | 'desc';
  /** 머리글 클릭 — sortBy null이면 정렬 해제. 바뀔 때마다 1페이지로 */
  onChange: (sortBy: string | null, sortDir: 'asc' | 'desc') => void;
}

/**
 * 서버 페이지네이션 표의 정렬 상태 — 받아 온 한 페이지 안에서만 정렬되던 문제(2026-10-02) 해결용.
 * 정렬 기준을 PageParams(sortBy/sortDir)에 실어 서버가 전체 행을 정렬한 뒤 페이지를 자르게 한다.
 * 정렬이 바뀌면 1페이지부터 다시 봐야 하므로 resetPage를 같이 부름
 */
export const useServerSort = (resetPage: () => void): ServerSortState => {
  const [sortBy, setSortBy]   = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const onChange = useCallback((by: string | null, dir: 'asc' | 'desc') => {
    setSortBy(by);
    setSortDir(dir);
    resetPage();
  }, [resetPage]);
  return { sortBy, sortDir, onChange };
};
