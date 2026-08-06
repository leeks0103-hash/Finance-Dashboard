import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChartTheme } from '@/hooks';
import { pathToTab } from '@/utils/routing';
import { useBackgroundPrefetch } from '@/hooks/useBackgroundPrefetch';
import FilterPanel from '@/components/features/FilterPanel';
import ActionBar   from '@/components/features/ActionBar';
import PerfFilter  from '@/layouts/PerformanceFilterBar/PerformanceFilterBar';
import styles from './TabLayout.module.css';

import type { TabId } from '@/components/ui/TabNav/TabNav';

const FinancePage     = lazy(() => import('@/pages/Finance'));
const KpiPage         = lazy(() => import('@/pages/Kpi'));
const PerformancePage = lazy(() => import('@/pages/Performance'));

const TabLayout = () => {
  useChartTheme();
  useBackgroundPrefetch();

  const location = useLocation();
  const navigate  = useNavigate();

  const activeTab    = useMemo(() => pathToTab(location.pathname), [location.pathname]);
  const setTab       = (tab: TabId) => navigate(`/${tab}`);
  const isFinance    = activeTab === 'finance';
  const isPerformance = activeTab === 'performance';

  const [mounted, setMounted] = useState<Set<TabId>>(() => new Set([pathToTab(location.pathname)]));
  useEffect(() => {
    setMounted(prev => {
      if (prev.has(activeTab)) return prev;
      return new Set([...prev, activeTab]);
    });
  }, [activeTab]);

  const show = (tab: TabId): React.CSSProperties =>
    ({ display: activeTab === tab ? undefined : 'none' });

  return (
    <>
      {/* filterGroup — 항상 렌더해서 높이 고정, 탭별 내용만 조건부 */}
      <div className={styles.filterGroup}>
        {isFinance && <><FilterPanel /><ActionBar /></>}
        {isPerformance && <PerfFilter />}
      </div>

      {/* ── 재무 데이터 — 항상 마운트 ── */}
      <div className={styles.pageContent} style={show('finance')}>
        <Suspense fallback={null}>
          <FinancePage />
        </Suspense>
      </div>

      {/* ── KPI — 첫 방문 후 keep-mount ── */}
      {mounted.has('kpi') && (
        <div className={styles.pageContent} style={show('kpi')}>
          <Suspense fallback={null}>
            <KpiPage />
          </Suspense>
        </div>
      )}

      {/* ── 실적 현황 — 첫 방문 후 keep-mount ── */}
      {mounted.has('performance') && (
        <div className={styles.pageContent} style={show('performance')}>
          <Suspense fallback={null}>
            <PerformancePage />
          </Suspense>
        </div>
      )}
    </>
  );
};

export default TabLayout;
