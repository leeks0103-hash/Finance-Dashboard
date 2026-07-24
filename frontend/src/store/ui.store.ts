import { create } from 'zustand';

interface UiStore {
  showChartLabels: boolean;
  toggleChartLabels: () => void;
}

export const useUiStore = create<UiStore>(set => ({
  showChartLabels: false,
  toggleChartLabels: () => set(s => ({ showChartLabels: !s.showChartLabels })),
}));
