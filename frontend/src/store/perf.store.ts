import { create } from 'zustand';
import { toggle } from '@/utils/array';

interface PerfStore {
  selectedParts: string[];
  selectedTeam: string;
  togglePart: (part: string) => void;
  setTeam: (team: string) => void;
  reset: () => void;
}

export const usePerfStore = create<PerfStore>(set => ({
  selectedParts: [],
  selectedTeam: '',
  togglePart: part => set(s => ({ selectedParts: toggle(s.selectedParts, part) })),
  setTeam: team => set({ selectedTeam: team }),
  reset: () => set({ selectedParts: [], selectedTeam: '' }),
}));
