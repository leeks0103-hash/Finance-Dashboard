import type { TabId } from '@/components/ui/TabNav/TabNav';

// 참고: 관리자 페이지(/admin…)는 여기서 'finance'로 떨어지지만 TabNav에 재무 탭이 없어 아무 탭도 켜지지 않고,
// 탭별 액션 바(KPI·실적)도 activeTab이 kpi/performance일 때만 그려져 관리자 페이지에선 안 보임(2026-10-23)
export function pathToTab(pathname: string): TabId {
  if (pathname.startsWith('/kpi'))          return 'kpi';
  if (pathname.startsWith('/performance'))  return 'performance';
  if (pathname.startsWith('/satisfaction')) return 'satisfaction';
  return 'finance';
}
