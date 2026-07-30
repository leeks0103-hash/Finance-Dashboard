import { lazy } from 'react';
import { FilterBar } from '@/layouts/FilterBar';
import { PerformanceFilterBar } from '@/layouts/PerformanceFilterBar';
import { TabNav } from '@/components/ui';
import { useChartTheme } from '@/hooks';
import { useTabStore } from '@/store/tab.store';

const FinancePage     = lazy(() => import('@/pages/Finance'));
const KpiPage         = lazy(() => import('@/pages/Kpi'));
const PerformancePage = lazy(() => import('@/pages/Performance'));

const TabLayout = () => {
  // Chart.js 테마 동기화 — 다크/라이트 전환 시 차트 색상 즉시 반영
  useChartTheme();

  // 탭 상태 — 어떤 페이지를 렌더링할지 결정
  const activeTab = useTabStore(s => s.activeTab);
  const setTab    = useTabStore(s => s.setTab);

  return (
    <>
      <TabNav active={activeTab} onChange={setTab} />
      {activeTab === 'finance'     && <FilterBar />}
      {activeTab === 'performance' && <PerformanceFilterBar />}
      {activeTab === 'finance'     && <FinancePage />}
      {activeTab === 'kpi'         && <KpiPage />}
      {activeTab === 'performance' && <PerformancePage />}
    </>
  );
};

export default TabLayout;
