import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Filters } from '@/types';
import { toggle } from '@/utils/array';

export interface FilterStoreShape extends Filters {
  initialized: boolean;
  /** syncOptions가 마지막으로 확인한 옵션 전체 목록 — 다음 호출 때 "새로 생긴 값"을 판별하는 기준 */
  knownYears:  string[];
  knownParts:  string[];
  knownStages: string[];
  toggleYear:  (year: string) => void;
  togglePart:  (part: string) => void;
  toggleStage: (stage: string) => void;
  reset: () => void;
  /**
   * 옵션 목록이 바뀔 때마다 호출 — 최초 방문이면 전체 선택으로 초기화(연도는 올해),
   * 이후엔 그동안 없던 새 옵션값만 선택에 추가한다. 사용자가 일부러 해제해 둔 기존 값은 건드리지 않음.
   * (예: KPI 파트에 "-"처럼 처음 보는 값이 나중에 추가돼도 대시보드에서 계속 빠지지 않게)
   */
  syncOptions: (years: string[], parts: string[], stages: string[]) => void;
}

/**
 * 연도/파트/보고단계 다중선택 필터 스토어 팩토리 — 재무·KPI 탭이 로직은 동일하되
 * 서로 독립된 필터 상태(별도 persist 키)를 갖도록 생성.
 */
export const createFilterStore = (persistName: string) =>
  create<FilterStoreShape>()(
    persist(
      (set, get) => ({
        years: [],
        parts: [],
        stages: [],
        initialized: false,
        knownYears:  [],
        knownParts:  [],
        knownStages: [],
        toggleYear:  year  => set(s => ({ years:  toggle(s.years,  year) })),
        togglePart:  part  => set(s => ({ parts:  toggle(s.parts,  part) })),
        toggleStage: stage => set(s => ({ stages: toggle(s.stages, stage) })),
        reset: () => set({ years: [], parts: [], stages: [] }),
        syncOptions: (years, parts, stages) => {
          const s = get();
          if (!s.initialized) {
            const currentYear = String(new Date().getFullYear());
            set({
              years:  years.includes(currentYear) ? [currentYear] : years,
              parts:  [...parts],
              stages: [...stages],
              knownYears: years, knownParts: parts, knownStages: stages,
              initialized: true,
            });
            return;
          }
          // 이전에 없던 옵션값만 선택에 추가 — 사용자가 일부러 해제한 기존 값은 그대로 둔다
          const addNew = (current: string[], known: string[], incoming: string[]) => {
            const fresh = incoming.filter(v => !known.includes(v) && !current.includes(v));
            return fresh.length ? [...current, ...fresh] : current;
          };
          set({
            years:  addNew(s.years,  s.knownYears,  years),
            parts:  addNew(s.parts,  s.knownParts,  parts),
            stages: addNew(s.stages, s.knownStages, stages),
            knownYears: years, knownParts: parts, knownStages: stages,
          });
        },
      }),
      {
        name: persistName,
        partialize: (s) => ({
          years: s.years, parts: s.parts, stages: s.stages, initialized: s.initialized,
          knownYears: s.knownYears, knownParts: s.knownParts, knownStages: s.knownStages,
        }),
      },
    ),
  );
