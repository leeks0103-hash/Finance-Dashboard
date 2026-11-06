import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EMPTY_COLOR_SET, sanitizeChartColorSet, type ChartColorSet } from '@/utils/chartColors';

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

  /** 2027 계획 보기 상단 안내 문구를 닫았는지(2026-10-29) — 닫으면 이 브라우저에선 다시 안 보임(localStorage) */
  planNoteDismissed: boolean;
  dismissPlanNote: () => void;

  /** "파트별 매출 실적 진행 현황" 보기 — 기존 막대('bars') / 장미('rose')(2026-11-06). 카드 왼쪽 아래 토글로 고르고 이 브라우저에 기억 */
  achieveView: 'bars' | 'rose';
  setAchieveView: (v: 'bars' | 'rose') => void;

  /** 알림 종에서 마지막으로 "확인한" 시점의 항목별 건수(2026-11-06) — 이보다 늘어난 게 있을 때만 빨간 점·팝업(메일함처럼).
   *  관리자마다 따로 봐야 해서 서버가 아니라 이 브라우저에 저장. 판정은 utils/notificationSeen */
  notificationSeen: Record<string, number> | null;
  setNotificationSeen: (v: Record<string, number> | null) => void;

  /** 이 브라우저(=이 PC)에 "파일 열기 도구"를 설치했는지(2026-11-06). 브라우저는 PC에 뭐가 깔렸는지 직접 볼 수 없어서,
   *  설치 프로그램이 끝나면 대시보드를 ?opentool=1로 열어 표시하거나(useOpenToolMarker), 설치 안내 창의 "설치했어요"로 켠다.
   *  서버(.env·DB)에 두지 않는 이유: PC마다 다른 값이고 서버는 접속자 PC를 알 수 없음. 꺼져 있으면 파일·폴더 바로가기 버튼이 안 보임 */
  openToolInstalled: boolean;
  setOpenToolInstalled: (v: boolean) => void;
  /** 파일 열기 도구 설치 안내 창 — 세션 한정(⚙ 메뉴·바로가기 첫 사용에서 엶) */
  openToolModalOpen: boolean;
  setOpenToolModalOpen: (v: boolean) => void;

  /** 이 브라우저가 관리자 인증됐는지 — useExtractJob이 동기화(키 자체는 extract.api가 localStorage에 보관).
   *  달성률·바로가기(↗) 공개 범위 자체는 서버 저장(useVisibility) — 예전엔 여기(브라우저별)라 남의 화면엔 안 먹었음 */
  /** 로그인 역할 — null이면 로그인 화면. 관리자 기능은 'admin'만(2026-10-13 일반 회원 분리) */
  authRole: 'admin' | 'user' | null;
  adminAuthed: boolean;   // authRole === 'admin' — 기존 사용처 호환
  setAuthRole: (role: 'admin' | 'user' | null) => void;

  /** 차트 역할별 사용자 지정 색(⚙ 설정 > 차트 색상, 2026-10-08) — 이 브라우저에만. 기본값과 같은 견본은 저장 안 함.
   *  주간/야간 따로(2026-10-19) */
  chartColors: ChartColorSet;
  /** 차트 색상 모달의 저장 버튼 — 고른 것 전체를 한 번에(2026-10-13, 예전엔 누를 때마다 바로 저장) */
  saveChartColors: (next: ChartColorSet) => void;
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

      planNoteDismissed: false,
      dismissPlanNote: () => set({ planNoteDismissed: true }),

      achieveView: 'bars',
      setAchieveView: (v) => set({ achieveView: v === 'rose' ? 'rose' : 'bars' }),

      notificationSeen: null,
      setNotificationSeen: (v) => set({ notificationSeen: v }),

      openToolInstalled: false,
      setOpenToolInstalled: (v) => set({ openToolInstalled: v }),
      openToolModalOpen: false,
      setOpenToolModalOpen: (v) => set({ openToolModalOpen: v }),

      authRole: null,
      adminAuthed: false,
      setAuthRole: (role) => set({ authRole: role, adminAuthed: role === 'admin' }),

      chartColors: EMPTY_COLOR_SET,
      saveChartColors: (next) => set({ chartColors: sanitizeChartColorSet(next) }),
    }),
    {
      name: 'ui-store',
      // 그래프 수치·표 실제값·재무 대조·투어 시청 여부·차트 색만 로컬에 저장 — 나머지는 세션 한정
      partialize: (s) => ({
        showChartLabels: s.showChartLabels, showRawValues: s.showRawValues, showFinCompare: s.showFinCompare, tourSeen: s.tourSeen,
        chartColors: s.chartColors, planNoteDismissed: s.planNoteDismissed, openToolInstalled: s.openToolInstalled, achieveView: s.achieveView,
        notificationSeen: s.notificationSeen,
      }),
      // 저장된 차트 색이 깨졌거나(직접 고친 localStorage·옛 형식) 모르는 값이면 버림
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<UiStore>;
        // 확인해 둔 알림 건수도 같은 이유로 — 숫자 값만 남기고, 모양이 틀리면 "확인 기록 없음"
        const seen = p.notificationSeen;
        const seenOk = seen && typeof seen === 'object' && !Array.isArray(seen)
          && Object.values(seen).every(v => typeof v === 'number' && Number.isFinite(v));
        return { ...current, ...p, chartColors: sanitizeChartColorSet(p.chartColors), notificationSeen: seenOk ? seen : null };
      },
    },
  ),
);
