import { useState, useCallback } from 'react';
import { type SortingState } from '@tanstack/react-table';
import { useProjects } from '@/hooks/useProjects';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import type { Project } from '@/types';

export interface ProjectTableViewModel {
  data:            Project[];
  isLoading:       boolean;
  isFetching:      boolean;
  busy:            boolean;
  sorting:         SortingState;
  onSortingChange: React.Dispatch<React.SetStateAction<SortingState>>;
  globalFilter:    string;
  onFilterChange:  React.Dispatch<React.SetStateAction<string>>;
  inputValue:      string;
  handleSearch:    (e: React.ChangeEvent<HTMLInputElement>) => void;
  getRowVariant:   (row: Project) => 'loss' | 'warn' | '';
  getPageLabel:    (pageIndex: number, pageCount: number) => string;
  getPageNumbers:  (currentPage: number, totalPages: number, windowSize?: number) => number[];
}

export const useProjectTableViewModel = (): ProjectTableViewModel => {
  const { data = [], isLoading, isFetching } = useProjects();
  const [sorting, setSorting] = useState<SortingState>([]);

  // 검색 UI 상태와 필터 값을 분리 — useDebouncedSearch로 추출
  const { inputValue, debouncedValue: globalFilter, handleChange: handleSearch } =
    useDebouncedSearch(350);

  return {
    data,
    isLoading,
    isFetching,
    busy: isLoading || isFetching,
    sorting,
    onSortingChange: setSorting,
    globalFilter,
    onFilterChange:  () => {},  // TanStack Table onGlobalFilterChange — debounce가 제어
    inputValue,
    handleSearch,
    getRowVariant: useCallback((row: Project): 'loss' | 'warn' | '' => {
      if (row.operating_profit < 0) return 'loss';
      if (row.profit_rate >= 0 && row.profit_rate < 5) return 'warn';
      return '';
    }, []),
    getPageLabel: useCallback(
      (pageIndex: number, pageCount: number): string =>
        pageCount > 0 ? `${pageIndex + 1} / ${pageCount}` : '0 / 0',
      []
    ),
    // 현재 페이지 주변 번호 배열 — UI 페이지네이션 버튼 렌더링용
    getPageNumbers: useCallback(
      (currentPage: number, totalPages: number, windowSize = 5): number[] => {
        if (totalPages <= windowSize) return Array.from({ length: totalPages }, (_, i) => i);
        const half = Math.floor(windowSize / 2);
        const start = Math.max(0, Math.min(currentPage - half, totalPages - windowSize));
        return Array.from({ length: windowSize }, (_, i) => start + i);
      },
      []
    ),
  };
};
