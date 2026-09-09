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
  const syncOptions = useKpiFilterStore(s => s.syncOptions);

  const { data: options } = useKpiFilterOptions();

  // 최초 방문 — 연도=올해, 파트/보고단계=전체 선택으로 시작. 이후엔 옵션이 바뀔 때마다
  // 그동안 없던 새 값(예: KPI 파트 "-")만 자동으로 선택에 추가 — 기존 선택은 그대로 유지
  useEffect(() => {
    const opts = options;
    if (opts?.years.length && opts?.parts.length && opts?.stages.length) {
      syncOptions(opts.years, opts.parts, opts.stages);
    }
  }, [options, syncOptions]);

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
