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

  /** 설정(⚙) 메뉴 제목 옆 단축키(G·W·F) 표시 — 설정의 "단축키" 줄에서 보이기/숨기기(2026-10-02) */
  showShortcutHints: boolean;
  toggleShortcutHints: () => void;

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

  /** 파트별 계획 vs 실적 드릴다운 표의 달성률 표시 — 관리자용 기능(Navbar)에서만 켤 수 있고 기본 꺼짐.
   *  저조한 팀이 한눈에 드러나지 않게 하려는 배려(2026-09-29). 실제 표시는 관리자 인증 상태일 때만 */
  showAchieveRate: boolean;
  toggleAchieveRate: () => void;

  /** 파일 바로가기(↗) 버튼 공개 범위 — 관리자용 기능(Navbar)에서 설정, 기본 관리자만.
   *  all 전체 / admin 관리자 인증된 브라우저만 / none 아무도 */
  fileOpenVisibility: FileOpenVisibility;
  setFileOpenVisibility: (v: FileOpenVisibility) => void;

  /** 이 브라우저가 관리자 인증됐는지 — useExtractJob이 동기화(키 자체는 extract.api가 localStorage에 보관) */
  adminAuthed: boolean;
  setAdminAuthed: (v: boolean) => void;
}

export type FileOpenVisibility = 'all' | 'admin' | 'none';

export const useUiStore = create<UiStore>()(
  persist(
    set => ({
      showChartLabels: true,

      showRawValues: false,
      toggleRawValues: () => set(s => ({ showRawValues: !s.showRawValues })),

      showFinCompare: false,
      toggleFinCompare: () => set(s => ({ showFinCompare: !s.showFinCompare })),

      showShortcutHints: true,
      toggleShortcutHints: () => set(s => ({ showShortcutHints: !s.showShortcutHints })),

      lastLoaded: null,
      setLastLoaded: (v) => set({ lastLoaded: v }),

      aiTriggered: {},
      setAiTriggered: (tab) => set(s => ({ aiTriggered: { ...s.aiTriggered, [tab]: true } })),

      tourSeen: false,
      markTourSeen: () => set({ tourSeen: true }),

      showAchieveRate: false,
      toggleAchieveRate: () => set(s => ({ showAchieveRate: !s.showAchieveRate })),

      fileOpenVisibility: 'admin',
      setFileOpenVisibility: (v) => set({ fileOpenVisibility: v }),

      adminAuthed: false,
      setAdminAuthed: (v) => set({ adminAuthed: v }),
    }),
    {
      name: 'ui-store',
      // 그래프 수치·표 실제값·재무 대조·달성률·바로가기 공개 범위·투어 시청 여부만 로컬에 저장 — 나머지는 세션 한정
      partialize: (s) => ({
        showChartLabels: s.showChartLabels, showRawValues: s.showRawValues, showFinCompare: s.showFinCompare, showShortcutHints: s.showShortcutHints, tourSeen: s.tourSeen,
        showAchieveRate: s.showAchieveRate, fileOpenVisibility: s.fileOpenVisibility,
      }),
    },
  ),
);
