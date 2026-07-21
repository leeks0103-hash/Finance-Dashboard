import { useState, useRef, useCallback, useEffect } from 'react';
import { debounce } from 'lodash-es';
import { type SortingState } from '@tanstack/react-table';
import { useProjects } from '@/hooks/useProjects';
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
}

export const useProjectTableViewModel = (): ProjectTableViewModel => {
  const { data = [], isLoading, isFetching } = useProjects();

  const [sorting, setSorting]           = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [inputValue, setInputValue]     = useState('');

  const debouncedSetFilter = useRef(
    debounce((val: string) => setGlobalFilter(val), 350)
  ).current;

  // 언마운트 시 pending 디바운스 취소 — stale 상태 업데이트 방지
  useEffect(() => () => debouncedSetFilter.cancel(), [debouncedSetFilter]);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    debouncedSetFilter(e.target.value);
  }, [debouncedSetFilter]);

  return {
    data,
    isLoading,
    isFetching,
    busy: isLoading || isFetching,
    sorting,
    onSortingChange: setSorting,
    globalFilter,
    onFilterChange:  setGlobalFilter,
    inputValue,
    handleSearch,
    getRowVariant: (row: Project) => {
      if (row.operating_profit < 0) return 'loss';
      if (row.profit_rate > 0 && row.profit_rate < 5) return 'warn';
      return '';
    },
  };
};
