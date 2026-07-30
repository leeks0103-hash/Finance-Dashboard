import { create } from 'zustand';
import { toggle } from '@/utils/array';

interface PerfStore {
  selectedParts: string[];
  togglePart: (part: string) => void;
  reset: () => void;
}

export const usePerfStore = create<PerfStore>(set => ({
  selectedParts: [],
  togglePart: part => set(s => ({ selectedParts: toggle(s.selectedParts, part) })),
  reset: () => set({ selectedParts: [] }),
}));
