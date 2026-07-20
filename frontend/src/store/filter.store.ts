import { create } from 'zustand';
import type { Filters } from '../types/finance.types';

interface FilterStore extends Filters {
  setYear: (year: string) => void;
  togglePart: (part: string) => void;
  toggleStage: (stage: string) => void;
  reset: () => void;
}

const toggle = (arr: string[], val: string): string[] =>
  arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

export const useFilterStore = create<FilterStore>(set => ({
  year: '',
  parts: [],
  stages: [],
  setYear: year => set({ year }),
  togglePart: part => set(s => ({ parts: toggle(s.parts, part) })),
  toggleStage: stage => set(s => ({ stages: toggle(s.stages, stage) })),
  reset: () => set({ year: '', parts: [], stages: [] }),
}));
