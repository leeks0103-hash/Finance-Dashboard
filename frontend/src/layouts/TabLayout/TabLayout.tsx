import { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FilterBar } from '@/layouts/FilterBar';
import { PerformanceFilterBar } from '@/layouts/PerformanceFilterBar';
import { TabNav } from '@/components/ui';
import { useChartTheme } from '@/hooks';
import { useBackgroundPrefetch } from '@/hooks/useBackgroundPrefetch';
import styles from './TabLayout.module.css';

const FinancePage     = lazy(() => import('@/pages/Finance'));
const KpiPage         = lazy(() => import('@/pages/Kpi'));
const PerformancePage = lazy(() => import('@/pages/Performance'));

type Tab = 'finance' | 'kpi' | 'performance';

function pathToTab(pathname: string): Tab {
  if (pathname.startsWith('/kpi'))         return 'kpi';
  if (pathname.startsWith('/performance')) return 'performance';
  return 'finance';
}

/**
 * Keep-mounted 탭 레이아웃
 * - URL(HashRouter) 기반으로 탭 상태 관리 → 새로고침해도 탭 유지
 * - 한 번 방문한 탭은 display:none으로만 숨김 → 재방문 시 리렌더링 없음
 */
const TabLayout = () => {
  useChartTheme();
  useBackgroundPrefetch();

  const location = useLocation();
  const navigate  = useNavigate();

  const activeTab = useMemo(() => pathToTab(location.pathname), [location.pathname]);
  const setTab    = (tab: Tab) => navigate(`/${tab}`);

  // 방문한 탭 추적 — 한 번이라도 방문하면 DOM에서 제거하지 않음
  const [mounted, setMounted] = useState<Set<Tab>>(() => new Set([pathToTab(location.pathname)]));
  useEffect(() => {
    setMounted(prev => {
      if (prev.has(activeTab)) return prev;
      return new Set([...prev, activeTab]);
    });
  }, [activeTab]);

  const show = (tab: Tab): React.CSSProperties =>
    ({ display: activeTab === tab ? undefined : 'none' });

  return (
    <>
      <TabNav active={activeTab} onChange={setTab} />

      {/* FilterBar — 활성 탭에만 표시 */}
      {activeTab === 'finance'     && <FilterBar />}
      {activeTab === 'performance' && <PerformanceFilterBar />}

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
