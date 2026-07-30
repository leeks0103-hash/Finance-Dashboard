import { lazy, Suspense } from 'react';
import { FilterBar } from '@/layouts/FilterBar';
import { PerformanceFilterBar } from '@/layouts/PerformanceFilterBar';
import { Spinner, TabNav } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
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
      {/* 탭 네비게이션 — sticky (navbar 바로 아래 고정) */}
      <TabNav active={activeTab} onChange={setTab} />

      {/* 탭별 필터바 — FilterBar와 동일한 레벨로 sticky */}
      {activeTab === 'finance'     && <FilterBar />}
      {activeTab === 'performance' && <PerformanceFilterBar />}

      <ErrorBoundary>
        <Suspense fallback={<Spinner size="lg" fullPage label="로딩 중…" />}>
          {activeTab === 'finance'     && <FinancePage />}
          {activeTab === 'kpi'         && <KpiPage />}
          {activeTab === 'performance' && <PerformancePage />}
        </Suspense>
      </ErrorBoundary>
    </>
  );
};

export default TabLayout;
