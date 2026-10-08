import { useCallback, useState } from 'react';

export interface ServerSortState {
  sortBy:  string | null;
  sortDir: 'asc' | 'desc';
  /** 머리글 클릭 — sortBy null이면 정렬 해제. 바뀔 때마다 1페이지로 */
  onChange: (sortBy: string | null, sortDir: 'asc' | 'desc') => void;
}

interface SavedSort { sortBy: string | null; sortDir: 'asc' | 'desc' }

const readSaved = (key: string): SavedSort | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SavedSort>;
    if (typeof v.sortBy !== 'string' || !v.sortBy) return null;
    return { sortBy: v.sortBy, sortDir: v.sortDir === 'desc' ? 'desc' : 'asc' };
  } catch {
    return null;
  }
};

/**
 * 서버 페이지네이션 표의 정렬 상태 — 받아 온 한 페이지 안에서만 정렬되던 문제(2026-10-02) 해결용.
 * 정렬 기준을 PageParams(sortBy/sortDir)에 실어 서버가 전체 행을 정렬한 뒤 페이지를 자르게 한다.
 * 정렬이 바뀌면 1페이지부터 다시 봐야 하므로 resetPage를 같이 부름.
 * storageKey를 주면 정렬을 localStorage(`sort-<key>`)에 저장해 새로고침 뒤에도 유지(2026-10-08).
 * 없어진 컬럼이 저장돼 있어도 서버 sort_frame이 모르는 컬럼은 무시하므로 안전
 */
export const useServerSort = (resetPage: () => void, storageKey?: string): ServerSortState => {
  const key = storageKey ? `sort-${storageKey}` : null;
  const [saved] = useState(() => (key ? readSaved(key) : null));
  const [sortBy, setSortBy]   = useState<string | null>(saved?.sortBy ?? null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(saved?.sortDir ?? 'asc');
  const onChange = useCallback((by: string | null, dir: 'asc' | 'desc') => {
    setSortBy(by);
    setSortDir(dir);
    if (key) {
      try {
        if (by) localStorage.setItem(key, JSON.stringify({ sortBy: by, sortDir: dir }));
        else localStorage.removeItem(key);
      } catch { /* 저장 불가(사생활 보호 모드 등) — 정렬은 그대로 동작 */ }
    }
    resetPage();
  }, [resetPage, key]);
  return { sortBy, sortDir, onChange };
};
