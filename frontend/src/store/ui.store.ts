import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiStore {
  showChartLabels: boolean;
  toggleChartLabels: () => void;

  lastLoaded: string | null;
  setLastLoaded: (v: string | null) => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    set => ({
      showChartLabels: true,
      toggleChartLabels: () => set(s => ({ showChartLabels: !s.showChartLabels })),

      lastLoaded: null,
      setLastLoaded: (v) => set({ lastLoaded: v }),
    }),
    {
      name: 'ui-store',
      // 그래프 수치 표시 여부만 테마처럼 로컬에 저장 — 나머지는 세션 한정
      partialize: (s) => ({ showChartLabels: s.showChartLabels }),
    },
  ),
);
