import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiStore {
  showChartLabels: boolean;

  /** 재무·실적 표 금액/비율 셀을 반올림(억/만 축약) 대신 원본 실제값으로 표시 — Navbar 설정에서 토글 */
  showRawValues: boolean;
  toggleRawValues: () => void;

  /** 완료 프로젝트 재무 대조 모드 — 켜면 프로젝트 상세에 재무 이력(완료) 매출·직접원가 컬럼이 실적현황 값 옆에 붙고
   *  비교 대상 칸 테두리가 빛남(2026-10-02). Navbar 설정에서 토글 */
  showFinCompare: boolean;
  toggleFinCompare: () => void;

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

  /** 이 브라우저가 관리자 인증됐는지 — useExtractJob이 동기화(키 자체는 extract.api가 localStorage에 보관).
   *  달성률·바로가기(↗) 공개 범위 자체는 서버 저장(useVisibility) — 예전엔 여기(브라우저별)라 남의 화면엔 안 먹었음 */
  adminAuthed: boolean;
  setAdminAuthed: (v: boolean) => void;
}

export const useUiStore = create<UiStore>()(
  persist(
    set => ({
      showChartLabels: true,

      showRawValues: false,
      toggleRawValues: () => set(s => ({ showRawValues: !s.showRawValues })),

      showFinCompare: false,
      toggleFinCompare: () => set(s => ({ showFinCompare: !s.showFinCompare })),

      lastLoaded: null,
      setLastLoaded: (v) => set({ lastLoaded: v }),

      aiTriggered: {},
      setAiTriggered: (tab) => set(s => ({ aiTriggered: { ...s.aiTriggered, [tab]: true } })),

      tourSeen: false,
      markTourSeen: () => set({ tourSeen: true }),

      adminAuthed: false,
      setAdminAuthed: (v) => set({ adminAuthed: v }),
    }),
    {
      name: 'ui-store',
      // 그래프 수치·표 실제값·재무 대조·투어 시청 여부만 로컬에 저장 — 나머지는 세션 한정
      partialize: (s) => ({
        showChartLabels: s.showChartLabels, showRawValues: s.showRawValues, showFinCompare: s.showFinCompare, tourSeen: s.tourSeen,
      }),
    },
  ),
);
