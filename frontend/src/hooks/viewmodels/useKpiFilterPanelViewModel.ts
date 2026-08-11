import { useKpiFilterStore } from '@/store/kpiFilter.store';
import { useKpiFilterOptions } from '@/hooks/useKpiFilterOptions';
import type { Filters } from '@/types';

const STAGE_ORDER = ['최종', '완료', '확정', '중간', '착수', '제안', '사전검토', '사업계획', '검토'];

const sortStages = (stages: string[]): string[] => {
  const known   = STAGE_ORDER.filter(s => stages.includes(s));
  const unknown = stages.filter(s => !STAGE_ORDER.includes(s)).sort();
  return [...known, ...unknown];
};

export interface KpiFilterPanelViewModel {
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
}

export const useKpiFilterPanelViewModel = (): KpiFilterPanelViewModel => {
  const years  = useKpiFilterStore(s => s.years);
  const parts  = useKpiFilterStore(s => s.parts);
  const stages = useKpiFilterStore(s => s.stages);
  const toggleYear  = useKpiFilterStore(s => s.toggleYear);
  const togglePart  = useKpiFilterStore(s => s.togglePart);
  const toggleStage = useKpiFilterStore(s => s.toggleStage);
  const reset       = useKpiFilterStore(s => s.reset);

  const { data: options } = useKpiFilterOptions();

  const hasActiveFilters = Boolean(years.length || parts.length || stages.length);
  const activeCount =
    (years.length > 0 ? 1 : 0) + (parts.length > 0 ? 1 : 0) + (stages.length > 0 ? 1 : 0);

  return {
    filters: { years, parts, stages },
    years:  options?.years ?? [],
    parts:  options?.parts ?? [],
    stages: sortStages(options?.stages ?? []),
    hasActiveFilters,
    activeCount,
    toggleYear,
    togglePart,
    toggleStage,
    resetFilters: reset,
  };
};
