import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toggle } from '@/utils/array';

interface PerfStore {
  selectedParts: string[];
  selectedTeam: string;
  initialized: boolean;
  togglePart: (part: string) => void;
  setTeam: (team: string) => void;
  reset: () => void;
  /** 최초 방문 시 한 번만 — 파트 전체 선택 상태로 시작 */
  initializeDefaults: (parts: string[]) => void;
}

export const usePerfStore = create<PerfStore>()(
  persist(
    (set, get) => ({
      selectedParts: [],
      selectedTeam: '',
      initialized: false,
      togglePart: part => set(s => ({ selectedParts: toggle(s.selectedParts, part) })),
      setTeam: team => set({ selectedTeam: team }),
      reset: () => set({ selectedParts: [], selectedTeam: '' }),
      initializeDefaults: (parts) => {
        if (get().initialized) return;
        set({ selectedParts: [...parts], initialized: true });
      },
    }),
    {
      name: 'perf-filter-store',
      partialize: s => ({
        selectedParts: s.selectedParts,
        selectedTeam:  s.selectedTeam,
        initialized:   s.initialized,
      }),
    },
  ),
);
