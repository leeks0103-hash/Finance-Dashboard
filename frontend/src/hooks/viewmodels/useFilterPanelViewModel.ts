import { useFilters } from '@/hooks/useFilters';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { usePrefetch } from '@/hooks/usePrefetch';
import { toggle } from '@/utils/array';
import type { Filters } from '@/types';

export interface FilterPanelViewModel {
  filters:       Filters;
  years:         string[];
  parts:         string[];
  stages:        string[];
  setYear:       (year: string) => void;
  togglePart:    (part: string) => void;
  toggleStage:   (stage: string) => void;
  prefetchYears: () => void;
  prefetchPart:  (part: string) => void;
  prefetchStage: (stage: string) => void;
}

export const useFilterPanelViewModel = (): FilterPanelViewModel => {
  const { filters, setYear, togglePart, toggleStage } = useFilters();
  const { years, parts, stages }                      = useFilterOptions();
  const { prefetch }                                  = usePrefetch();

  return {
    filters,
    years,
    parts,
    stages,
    setYear,
    togglePart,
    toggleStage,
    prefetchYears: () => { years.forEach(y => prefetch({ ...filters, year: y })); },
    prefetchPart:  (part)  => prefetch({ ...filters, parts:  toggle(filters.parts,  part)  }),
    prefetchStage: (stage) => prefetch({ ...filters, stages: toggle(filters.stages, stage) }),
  };
};
