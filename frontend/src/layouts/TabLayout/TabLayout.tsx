import { lazy, Suspense, useState, useEffect } from 'react';
import { FilterBar } from '@/layouts/FilterBar';
import { PerformanceFilterBar } from '@/layouts/PerformanceFilterBar';
import { TabNav } from '@/components/ui';
import { useChartTheme } from '@/hooks';
import { useTabStore } from '@/store/tab.store';
import { useBackgroundPrefetch } from '@/hooks/useBackgroundPrefetch';

const FinancePage     = lazy(() => import('@/pages/Finance'));
const KpiPage         = lazy(() => import('@/pages/Kpi'));
const PerformancePage = lazy(() => import('@/pages/Performance'));

type Tab = 'finance' | 'kpi' | 'performance';

/**
 * Keep-mounted 탭 레이아웃
 * - 한 번 방문한 탭은 display:none으로만 숨김 → 재방문 시 리렌더링 없음
 * - 백그라운드 프리패치로 첫 방문 시 데이터 이미 캐싱
 */
const TabLayout = () => {
  useChartTheme();
  useBackgroundPrefetch(); // 2초 후 실적·KPI 데이터 백그라운드 캐싱

  const activeTab = useTabStore(s => s.activeTab);
  const setTab    = useTabStore(s => s.setTab);

  // 방문한 탭 추적 — 한 번이라도 방문하면 DOM에서 제거하지 않음
  const [mounted, setMounted] = useState<Set<Tab>>(new Set(['finance']));
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
      <div style={show('finance')}>
        <Suspense fallback={null}>
          <FinancePage />
        </Suspense>
      </div>

      {/* ── KPI — 첫 방문 후 keep-mount ── */}
      {mounted.has('kpi') && (
        <div style={show('kpi')}>
          <Suspense fallback={null}>
            <KpiPage />
          </Suspense>
        </div>
      )}

      {/* ── 실적 현황 — 첫 방문 후 keep-mount ── */}
      {mounted.has('performance') && (
        <div style={show('performance')}>
          <Suspense fallback={null}>
            <PerformancePage />
          </Suspense>
        </div>
      )}
    </>
  );
};

export default TabLayout;
