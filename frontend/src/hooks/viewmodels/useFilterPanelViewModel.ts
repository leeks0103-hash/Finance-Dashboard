import { useFilters } from '@/hooks/useFilters';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { usePrefetch } from '@/hooks/usePrefetch';
import { toggle } from '@/utils/array';
import { sortStages } from '@/utils/stageOrder';
import type { Filters } from '@/types';

export interface FilterPanelViewModel {
  filters:          Filters;
  years:            string[];
  parts:            string[];
  stages:           string[];
  hasActiveFilters: boolean;
  activeCount:      number;
  toggleYear:       (year: string) => void;
  togglePart:       (part: string) => void;
  toggleStage:      (stage: string) => void;
  resetFilters:     () => void;
  prefetchYear:     (year: string) => void;
  prefetchPart:     (part: string) => void;
  prefetchStage:    (stage: string) => void;
}

export const useFilterPanelViewModel = (): FilterPanelViewModel => {
  const { filters, toggleYear, togglePart, toggleStage, reset } = useFilters();
  const { years, parts, stages }                                 = useFilterOptions();
  const { prefetch }                                             = usePrefetch();

  const hasActiveFilters = Boolean(filters.years.length || filters.parts.length || filters.stages.length);
  const activeCount      =
    (filters.years.length > 0 ? 1 : 0) + (filters.parts.length > 0 ? 1 : 0) + (filters.stages.length > 0 ? 1 : 0);

  return {
    filters,
    years,
    parts,
    stages: sortStages(stages),
    hasActiveFilters,
    activeCount,
    toggleYear,
    togglePart,
    toggleStage,
    resetFilters:  reset,
    prefetchYear:  (year)  => prefetch({ ...filters, years:  toggle(filters.years,  year) }),
    prefetchPart:  (part)  => prefetch({ ...filters, parts:  toggle(filters.parts,  part) }),
    prefetchStage: (stage) => prefetch({ ...filters, stages: toggle(filters.stages, stage) }),
  };
};
