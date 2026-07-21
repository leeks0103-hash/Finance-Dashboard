import { useState, useRef, useCallback } from 'react';
import { debounce } from 'lodash-es';
import { type SortingState } from '@tanstack/react-table';
import { useProjects } from '@/hooks/useProjects';
import type { Project } from '@/types';

export interface ProjectTableViewModel {
  data:         Project[];
  isLoading:    boolean;
  isFetching:   boolean;
  busy:         boolean;
  sorting:      SortingState;
  setSorting:   React.Dispatch<React.SetStateAction<SortingState>>;
  globalFilter: string;
  setGlobalFilter: React.Dispatch<React.SetStateAction<string>>;
  inputValue:   string;
  handleSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const useProjectTableViewModel = (): ProjectTableViewModel => {
  const { data = [], isLoading, isFetching } = useProjects();

  const [sorting, setSorting]           = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [inputValue, setInputValue]     = useState('');

  const debouncedSetFilter = useRef(
    debounce((val: string) => setGlobalFilter(val), 350)
  ).current;

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
    setSorting,
    globalFilter,
    setGlobalFilter,
    inputValue,
    handleSearch,
  };
};
