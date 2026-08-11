import { create } from 'zustand';
import type { Filters } from '@/types';
import { toggle } from '@/utils/array';

interface KpiFilterStore extends Filters {
  toggleYear:  (year: string) => void;
  togglePart:  (part: string) => void;
  toggleStage: (stage: string) => void;
  reset: () => void;
}

export const useKpiFilterStore = create<KpiFilterStore>(set => ({
  years: [],
  parts: [],
  stages: [],
  toggleYear:  year  => set(s => ({ years:  toggle(s.years,  year) })),
  togglePart:  part  => set(s => ({ parts:  toggle(s.parts,  part) })),
  toggleStage: stage => set(s => ({ stages: toggle(s.stages, stage) })),
  reset: () => set({ years: [], parts: [], stages: [] }),
}));
