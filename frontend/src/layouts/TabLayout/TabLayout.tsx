import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useChartTheme } from '@/hooks';
import { pathToTab } from '@/utils/routing';
import { useBackgroundPrefetch } from '@/hooks/useBackgroundPrefetch';
import FilterPanel  from '@/components/features/FilterPanel';
import ActionBar    from '@/components/features/ActionBar';
import PerformanceActionBar from '@/components/features/PerformanceActionBar';
import PerfFilter   from '@/layouts/PerformanceFilterBar/PerformanceFilterBar';
import styles from './TabLayout.module.css';

import type { TabId } from '@/components/ui/TabNav/TabNav';

const FinancePage      = lazy(() => import('@/pages/Finance'));
const KpiPage          = lazy(() => import('@/pages/Kpi'));
const PerformancePage  = lazy(() => import('@/pages/Performance'));
const SatisfactionPage = lazy(() => import('@/pages/Satisfaction'));

const TabLayout = () => {
  useChartTheme();
  useBackgroundPrefetch();

  const location = useLocation();

  const activeTab    = useMemo(() => pathToTab(location.pathname), [location.pathname]);
  const isFinance    = activeTab === 'finance';
  const isKpi        = activeTab === 'kpi';
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
      {/* filterGroup — 재무·실적만. KPI는 칩 필터바 제거(파트/보고단계 셀렉트는 KpiPage 안으로),
          다운로드 버튼은 Navbar로 이동 → KPI 탭에선 이 바 자체를 렌더하지 않음 */}
      {!isKpi && (
        <div className={styles.filterGroup}>
          {isFinance && <><FilterPanel /><ActionBar /></>}
          {isPerformance && <><PerfFilter /><PerformanceActionBar /></>}
        </div>
      )}

      {/* ── 재무현황(구 실적 현황) — 항상 마운트, 랜딩 탭 ── */}
      <div className={styles.pageContent} style={show('performance')}>
        <Suspense fallback={null}>
          <PerformancePage />
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

      {/* ── 재무 데이터(구 탭, /finance URL 직접 접근용) — 첫 방문 후 keep-mount ── */}
      {mounted.has('finance') && (
        <div className={styles.pageContent} style={show('finance')}>
          <Suspense fallback={null}>
            <FinancePage />
          </Suspense>
        </div>
      )}

      {/* ── 강사만족도 — 첫 방문 후 keep-mount (데이터 소스 미정, 플레이스홀더) ── */}
      {mounted.has('satisfaction') && (
        <div className={styles.pageContent} style={show('satisfaction')}>
          <Suspense fallback={null}>
            <SatisfactionPage />
          </Suspense>
        </div>
      )}
    </>
  );
};

export default TabLayout;
