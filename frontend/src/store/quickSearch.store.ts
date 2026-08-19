import { create } from 'zustand';

interface QuickSearchStore {
  finance: string;
  perf:    string;
  setFinance: (q: string) => void;
  setPerf:    (q: string) => void;
}

export const useQuickSearchStore = create<QuickSearchStore>()(set => ({
  finance: '',
  perf:    '',
  setFinance: (q) => set({ finance: q }),
  setPerf:    (q) => set({ perf:    q }),
}));
