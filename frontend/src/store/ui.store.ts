import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiStore {
  showChartLabels: boolean;

  /** 재무·실적 표 금액/비율 셀을 반올림(억/만 축약) 대신 원본 실제값으로 표시 — Navbar 설정에서 토글 */
  showRawValues: boolean;
  toggleRawValues: () => void;

  lastLoaded: string | null;
  setLastLoaded: (v: string | null) => void;

  /** AI 인사이트 위젯이 탭 전환(Navbar ActionBar 조건부 마운트)으로 언마운트돼도
   *  "분석 시작했는지" 여부는 유지 — 탭 왔다갔다해도 쿼리가 처음부터 다시 시작한
   *  것처럼 보이지 않도록. key는 useAiAnalysis의 AiTab('finance'|'kpi') */
  aiTriggered: Record<string, boolean>;
  setAiTriggered: (tab: string) => void;

  /** 사용법 투어(driver.js)를 본 적 있는지 — 첫 방문 1회 자동 실행 판별용.
   *  배포 전이라 사용자 계정으로 구분할 수 없어 임시로 브라우저(localStorage) 기준 */
  tourSeen: boolean;
  markTourSeen: () => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    set => ({
      showChartLabels: true,

      showRawValues: false,
      toggleRawValues: () => set(s => ({ showRawValues: !s.showRawValues })),

      lastLoaded: null,
      setLastLoaded: (v) => set({ lastLoaded: v }),

      aiTriggered: {},
      setAiTriggered: (tab) => set(s => ({ aiTriggered: { ...s.aiTriggered, [tab]: true } })),

      tourSeen: false,
      markTourSeen: () => set({ tourSeen: true }),
    }),
    {
      name: 'ui-store',
      // 그래프 수치·표 실제값 표시 여부·투어 시청 여부만 로컬에 저장 — 나머지는 세션 한정
      partialize: (s) => ({ showChartLabels: s.showChartLabels, showRawValues: s.showRawValues, tourSeen: s.tourSeen }),
    },
  ),
);
