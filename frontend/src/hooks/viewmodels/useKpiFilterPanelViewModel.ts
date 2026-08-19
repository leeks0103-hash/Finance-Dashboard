import { useEffect } from 'react';
import { useKpiFilterStore } from '@/store/kpiFilter.store';
import { useKpiFilterOptions } from '@/hooks/useKpiFilterOptions';
import { sortStages } from '@/utils/stageOrder';
import type { Filters } from '@/types';

export interface KpiFilterPanelViewModel {
  filters:          Filters;
  years:            string[];
  parts:            string[];
  stages:           string[];
  toggleYear:       (year: string) => void;
  togglePart:       (part: string) => void;
  toggleStage:      (stage: string) => void;
}

export const useKpiFilterPanelViewModel = (): KpiFilterPanelViewModel => {
  const years  = useKpiFilterStore(s => s.years);
  const parts  = useKpiFilterStore(s => s.parts);
  const stages = useKpiFilterStore(s => s.stages);
  const toggleYear  = useKpiFilterStore(s => s.toggleYear);
  const togglePart  = useKpiFilterStore(s => s.togglePart);
  const toggleStage = useKpiFilterStore(s => s.toggleStage);
  const initialized         = useKpiFilterStore(s => s.initialized);
  const initializeDefaults  = useKpiFilterStore(s => s.initializeDefaults);

  const { data: options } = useKpiFilterOptions();

  // 최초 방문 시 한 번만 — 연도=올해, 파트/보고단계=전체 선택 상태로 시작
  useEffect(() => {
    const opts = options;
    if (!initialized && opts?.years.length && opts?.parts.length && opts?.stages.length) {
      initializeDefaults(opts.years, opts.parts, opts.stages);
    }
  }, [initialized, options, initializeDefaults]);

  return {
    filters: { years, parts, stages },
    years:  options?.years ?? [],
    parts:  options?.parts ?? [],
    stages: sortStages(options?.stages ?? []),
    toggleYear,
    togglePart,
    toggleStage,
  };
};
