import { useFilters } from '@/hooks/useFilters';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { usePrefetch } from '@/hooks/usePrefetch';
import { toggle } from '@/utils/array';
import type { Filters } from '@/types';

export interface FilterPanelViewModel {
  filters:          Filters;
  years:            string[];
  parts:            string[];
  stages:           string[];
  hasActiveFilters: boolean;
  activeCount:      number;
  setYear:          (year: string) => void;
  toggleYear:       (year: string) => void;   // chip 단일 선택용 (재클릭 시 해제)
  togglePart:       (part: string) => void;
  toggleStage:      (stage: string) => void;
  resetFilters:     () => void;
  prefetchYear:     (year: string) => void;
  prefetchPart:     (part: string) => void;
  prefetchStage:    (stage: string) => void;
}

export const useFilterPanelViewModel = (): FilterPanelViewModel => {
  const { filters, setYear, togglePart, toggleStage, reset } = useFilters();
  const { years, parts, stages }                             = useFilterOptions();
  const { prefetch }                                         = usePrefetch();

  const hasActiveFilters = Boolean(filters.year || filters.parts.length || filters.stages.length);
  const activeCount      =
    (filters.year ? 1 : 0) + (filters.parts.length > 0 ? 1 : 0) + (filters.stages.length > 0 ? 1 : 0);

  return {
    filters,
    years,
    parts,
    stages,
    hasActiveFilters,
    activeCount,
    setYear,
    toggleYear:    (year) => setYear(filters.year === year ? '' : year),
    togglePart,
    toggleStage,
    resetFilters:  reset,
    prefetchYear:  (year) => prefetch({ ...filters, year }),
    prefetchPart:  (part)  => prefetch({ ...filters, parts:  toggle(filters.parts,  part) }),
    prefetchStage: (stage) => prefetch({ ...filters, stages: toggle(filters.stages, stage) }),
  };
};
