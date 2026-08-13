import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Filters } from '@/types';
import { toggle } from '@/utils/array';

interface KpiFilterStore extends Filters {
  initialized: boolean;
  toggleYear:  (year: string) => void;
  togglePart:  (part: string) => void;
  toggleStage: (stage: string) => void;
  reset: () => void;
  /** 최초 방문 시 한 번만 — 연도=올해, 파트/보고단계=전체 선택 상태로 시작 */
  initializeDefaults: (years: string[], parts: string[], stages: string[]) => void;
}

export const useKpiFilterStore = create<KpiFilterStore>()(
  persist(
    (set, get) => ({
      years: [],
      parts: [],
      stages: [],
      initialized: false,
      toggleYear:  year  => set(s => ({ years:  toggle(s.years,  year) })),
      togglePart:  part  => set(s => ({ parts:  toggle(s.parts,  part) })),
      toggleStage: stage => set(s => ({ stages: toggle(s.stages, stage) })),
      reset: () => set({ years: [], parts: [], stages: [] }),
      initializeDefaults: (years, parts, stages) => {
        if (get().initialized) return;
        const currentYear = String(new Date().getFullYear());
        set({
          years:  years.includes(currentYear) ? [currentYear] : years,
          parts:  [...parts],
          stages: [...stages],
          initialized: true,
        });
      },
    }),
    {
      name: 'kpi-filter-store',
      partialize: (s) => ({ years: s.years, parts: s.parts, stages: s.stages, initialized: s.initialized }),
    },
  ),
);
