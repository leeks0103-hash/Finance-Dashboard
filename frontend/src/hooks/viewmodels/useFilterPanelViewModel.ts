import { useEffect } from 'react';
import { useFilters } from '@/hooks/useFilters';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { usePrefetch } from '@/hooks/usePrefetch';
import { useFilterStore } from '@/store';
import { useUrlFilterSync } from '@/hooks/useUrlFilterSync';
import { toggle } from '@/utils/array';
import { sortStages } from '@/utils/stageOrder';
import type { Filters } from '@/types';

export interface FilterPanelViewModel {
  filters:          Filters;
  years:            string[];
  parts:            string[];
  stages:           string[];
  toggleYear:       (year: string) => void;
  togglePart:       (part: string) => void;
  toggleStage:      (stage: string) => void;
  prefetchYear:     (year: string) => void;
  prefetchPart:     (part: string) => void;
  prefetchStage:    (stage: string) => void;
}

export const useFilterPanelViewModel = (): FilterPanelViewModel => {
  const { filters, toggleYear, togglePart, toggleStage } = useFilters();
  const { years, parts, stages }                          = useFilterOptions();
  const { prefetch }                                      = usePrefetch();

  const initialized        = useFilterStore(s => s.initialized);
  const initializeDefaults = useFilterStore(s => s.initializeDefaults);

  // 최초 방문 시 한 번만 — 연도=올해, 파트/보고단계=전체 선택 상태로 시작
  useEffect(() => {
    if (!initialized && years.length && parts.length && stages.length) {
      initializeDefaults(years, parts, stages);
    }
  }, [initialized, years, parts, stages, initializeDefaults]);

  // URL ↔ 스토어 동기화 (공유 링크)
  useUrlFilterSync(
    filters.years, filters.parts, filters.stages,
    (y, p, s) => useFilterStore.setState({ years: y, parts: p, stages: s, initialized: true }),
  );

  return {
    filters,
    years,
    parts,
    stages: sortStages(stages),
    toggleYear,
    togglePart,
    toggleStage,
    prefetchYear:  (year)  => prefetch({ ...filters, years:  toggle(filters.years,  year) }),
    prefetchPart:  (part)  => prefetch({ ...filters, parts:  toggle(filters.parts,  part) }),
    prefetchStage: (stage) => prefetch({ ...filters, stages: toggle(filters.stages, stage) }),
  };
};
