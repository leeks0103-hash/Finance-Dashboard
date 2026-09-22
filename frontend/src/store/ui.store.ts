import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiStore {
  showChartLabels: boolean;
  toggleChartLabels: () => void;

  lastLoaded: string | null;
  setLastLoaded: (v: string | null) => void;

  /** AI 인사이트 위젯이 탭 전환(Navbar ActionBar 조건부 마운트)으로 언마운트돼도
   *  "분석 시작했는지" 여부는 유지 — 탭 왔다갔다해도 쿼리가 처음부터 다시 시작한
   *  것처럼 보이지 않도록. key는 useAiAnalysis의 AiTab('finance'|'kpi') */
  aiTriggered: Record<string, boolean>;
  setAiTriggered: (tab: string) => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    set => ({
      showChartLabels: true,
      toggleChartLabels: () => set(s => ({ showChartLabels: !s.showChartLabels })),

      lastLoaded: null,
      setLastLoaded: (v) => set({ lastLoaded: v }),

      aiTriggered: {},
      setAiTriggered: (tab) => set(s => ({ aiTriggered: { ...s.aiTriggered, [tab]: true } })),
    }),
    {
      name: 'ui-store',
      // 그래프 수치 표시 여부만 테마처럼 로컬에 저장 — 나머지는 세션 한정
      partialize: (s) => ({ showChartLabels: s.showChartLabels }),
    },
  ),
);
