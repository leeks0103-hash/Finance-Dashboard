import { create } from 'zustand';

interface UiStore {
  showChartLabels: boolean;
  toggleChartLabels: () => void;

  lastLoaded: string | null;
  setLastLoaded: (v: string | null) => void;

  showLogScale: boolean;
  toggleLogScale: () => void;

  showYearChart: boolean;
  toggleYearChart: () => void;
}

export const useUiStore = create<UiStore>(set => ({
  showChartLabels: false,
  toggleChartLabels: () => set(s => ({ showChartLabels: !s.showChartLabels })),

  lastLoaded: null,
  setLastLoaded: (v) => set({ lastLoaded: v }),

  showLogScale: false,
  toggleLogScale: () => set(s => ({ showLogScale: !s.showLogScale })),

  showYearChart: false,
  toggleYearChart: () => set(s => ({ showYearChart: !s.showYearChart })),
}));
