import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toggle } from '@/utils/array';

interface PerfStore {
  selectedParts: string[];
  selectedTeam: string;
  initialized: boolean;
  togglePart: (part: string) => void;
  /** 팀 선택 시 그 팀 소속 파트로 칩 선택을 동기화(전체 팀 선택 시 호출부가 전체 파트 목록을 넘김) */
  setTeam: (team: string, teamParts: string[]) => void;
  /** 파트 칩을 팀 소속 세트와 다르게 수동 조작하면 팀 라벨만 "전체 팀"으로 되돌림(파트 선택은 유지) */
  clearTeamLabel: () => void;
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
      setTeam: (team, teamParts) => set({ selectedTeam: team, selectedParts: [...teamParts] }),
      clearTeamLabel: () => set(s => (s.selectedTeam ? { selectedTeam: '' } : s)),
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
