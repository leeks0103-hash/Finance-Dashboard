import { useState } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { usePerformanceViewModel } from '@/hooks/viewmodels/usePerformanceViewModel';
import type { PerfPartRow } from '@/hooks/viewmodels/usePerformanceViewModel';
import { ChartCard, BarChart, DataTable, KpiCard } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import PerformanceInsightSection from '@/components/features/PerformanceInsightSection';
import PartAchievementBars from '@/components/features/PartAchievementBars/PartAchievementBars';
import { perfColumns, PERF_HIDEABLE_COLS } from '@/components/features/PerformanceTable/columns';
import type { PerfProject } from '@/types/performance.types';
import { PERF_YEAR, PERF_MONTH } from '@/utils';
import styles from './PerformancePage.module.css';

// 파트별 실적 컬럼 — 모듈 스코프에서 한 번만 생성 (stable reference)
const hp = createColumnHelper<PerfPartRow>();
const byPartColumns = [
  hp.accessor('part', {
    header: '파트', enableSorting: true,
    cell: i => i.getValue().replace(/^[①-⑦]\s*/, ''),
  }),
  hp.accessor('planInitial',   { header: '매출 계획',    enableSorting: true }),
  hp.accessor('junActual',     { header: `${PERF_MONTH} 실적`,     enableSorting: true }),
  hp.accessor('junCost',       { header: `${PERF_MONTH} 원가` }),
  hp.accessor('costRateStr',   { header: '원가율' }),
  hp.accessor('junCheckTotal', { header: `${PERF_MONTH} 점검 연간` }),
  hp.accessor('operatingProfit', {
    header: '경상손익',
    cell: i => {
      const row = i.row.original;
      return (
        <span style={{ color: row.isLoss ? 'var(--loss)' : 'var(--profit)', fontWeight: row.isLoss ? 600 : undefined }}>
          {row.operatingProfit}
        </span>
      );
    },
  }),
  hp.accessor('profitRate', { header: '손익률' }),
  hp.accessor('count',      { header: '건수', cell: i => String(i.getValue()) }),
];

const PerformancePage = () => {
  const vm = usePerformanceViewModel();
  const [showAchieve, setShowAchieve] = useState(true);

  return (
    <main className={styles.main}>

      {/* KPI 카드 */}
      <div className={styles.kpiGrid}>
        {vm.kpiCards.map(card => (
          <KpiCard
            key={card.label}
            label={card.label}
            value={card.value}
            accent={card.accent}
            sub={card.sub}
            trendUp={card.trendUp}
            trend={card.trend}
          />
        ))}
      </div>

      {/* 월별 실적 차트 */}
      <ChartCard>
        <ChartCard.Title>월별 실적 현황 ({PERF_MONTH} 점검 기준, 억원)</ChartCard.Title>
        <ChartCard.Body>
          <div className={styles.chartWrap}>
            <BarChart
              labels={vm.chartLabels}
              datasets={vm.chartDatasets}
              options={{
                ...vm.chartOptions,
                scales: { y: { ticks: { color: vm.chartTickColor, callback: v => v + '억' } }, x: { ticks: { color: vm.chartTickColor } } },
              }}
            />
          </div>
        </ChartCard.Body>
      </ChartCard>

      {/* 파트별 달성 현황 진행바 */}
      {vm.byPart.length > 0 && (
        <PartAchievementBars
          rows={vm.byPart}
          visible={showAchieve}
          onToggle={() => setShowAchieve(v => !v)}
          month={PERF_MONTH}
        />
      )}

      {/* 파트별 실적 — PerfPartRow 타입으로 DataTable<PerfPartRow> */}
      <div className={styles.sectionGroup}>
        <h3 className={styles.sectionTitle}>파트별 실적 ({PERF_YEAR} {PERF_MONTH} 기준, 억원)</h3>
        <div className={styles.section}>
        <DataTable<PerfPartRow>
          data={vm.byPart}
          columns={byPartColumns as never}
          getRowId={(row) => row.part}
          getRowVariant={(row) => row.isLoss ? 'loss' : ''}
          defaultPageSize={10}
          pageSizeOptions={[10]}
          compact
          hideToolbar
        />
        </div>
      </div>

      {/* 실적 인사이트 — 목표 대비 부진/손실 자동 분석 */}
      <ErrorBoundary><PerformanceInsightSection /></ErrorBoundary>

      {/* 프로젝트 상세 — title을 DataTable 내부로 이동해 재무 상세와 동일한 구도 */}
      <DataTable<PerfProject>
        data={vm.projects}
        columns={perfColumns as never}
        getRowId={(row) => String(row._row_num)}
        title="프로젝트 상세"
        isLoading={vm.isLoading}
        isFetching={vm.isFetching}
        stickyFirstCol
        getRowVariant={(row) =>
          row.operating_profit < 0 ? 'loss' : row.profit_rate < 5 ? 'warn' : ''
        }
        hideableColumns={PERF_HIDEABLE_COLS}
        serverPagination={vm.serverPagination}
        serverSearch={vm.serverSearch}
        searchPlaceholder="프로젝트코드·이름·담당자 검색…"
        emptyIcon="🔍"
        emptyTitle="검색 결과 없음"
        emptyDescription="다른 검색어나 필터 조건을 시도해보세요."
        storageKey="performance-project"
        copyableColumns={['filename']}
        searchOnDblClick={['project_code']}
      />

    </main>
  );
};

export default PerformancePage;
