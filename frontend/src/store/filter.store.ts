import { create } from 'zustand';
import type { Filters } from '@/types';
import { toggle } from '@/utils/array'; // M-13: 공유 유틸 사용

interface FilterStore extends Filters {
  setYear: (year: string) => void;
  togglePart: (part: string) => void;
  toggleStage: (stage: string) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterStore>(set => ({
  year: '',
  parts: [],
  stages: [],
  setYear: year => set({ year }),
  togglePart: part => set(s => ({ parts: toggle(s.parts, part) })),
  toggleStage: stage => set(s => ({ stages: toggle(s.stages, stage) })),
  reset: () => set({ year: '', parts: [], stages: [] }),
}));
