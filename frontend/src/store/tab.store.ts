import { create } from 'zustand';

export type TabId = 'finance' | 'kpi' | 'performance';

interface TabStore {
  activeTab: TabId;
  setTab: (tab: TabId) => void;
}

export const useTabStore = create<TabStore>(set => ({
  activeTab: 'finance',
  setTab: tab => set({ activeTab: tab }),
}));
