import type { TabId } from '@/components/ui/TabNav/TabNav';

export function pathToTab(pathname: string): TabId {
  if (pathname.startsWith('/kpi'))         return 'kpi';
  if (pathname.startsWith('/performance')) return 'performance';
  return 'finance';
}
