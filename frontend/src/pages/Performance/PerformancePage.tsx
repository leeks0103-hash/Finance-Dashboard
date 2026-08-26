import { createColumnHelper } from '@tanstack/react-table';
import { usePerformanceViewModel } from '@/hooks/viewmodels/usePerformanceViewModel';
import type { PerfPartRow } from '@/hooks/viewmodels/usePerformanceViewModel';
import { DataTable, KpiCard, InfoButton } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import PerformanceChartSection from '@/components/features/PerformanceChartSection/PerformanceChartSection';
import PerformanceInsightSection from '@/components/features/PerformanceInsightSection';
import PartAchievementBars from '@/components/features/PartAchievementBars/PartAchievementBars';
import { perfColumns, PERF_HIDEABLE_COLS } from '@/components/features/PerformanceTable/columns';
import FinanceCrossCheckPanel from '@/components/features/PerformanceTable/FinanceCrossCheckPanel';
import FinanceSearchResults from '@/components/features/PerformanceTable/FinanceSearchResults';
import type { PerfProject } from '@/types/performance.types';
import { PERF_YEAR, PERF_MONTH } from '@/utils';
import {
  INFO_ACHIEVEMENT_BARS,
  INFO_PART_TABLE,
  INFO_INSIGHT,
  INFO_PROJECT_TABLE,
  INFO_FINANCE_SEARCH,
} from '@/utils/infoTexts';
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

  return (
    <main className={styles.main}>

      {/* KPI 카드 */}
      <div className="fadeUp" style={{ animationDelay: '0ms' }}>
        <ErrorBoundary>
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
        </ErrorBoundary>
      </div>

      {/* 차트 섹션 */}
      <div className="fadeUp" style={{ animationDelay: '100ms' }}>
        <ErrorBoundary><PerformanceChartSection /></ErrorBoundary>
      </div>

      {/* 파트별 달성 현황 진행바 */}
      {vm.byPart.length > 0 && (
        <div className="fadeUp" style={{ animationDelay: '150ms' }}>
          <ErrorBoundary>
            <PartAchievementBars rows={vm.byPart} month={PERF_MONTH} info={INFO_ACHIEVEMENT_BARS} />
          </ErrorBoundary>
        </div>
      )}

      {/* 파트별 실적 */}
      <div className="fadeUp" style={{ animationDelay: '200ms' }}>
        <ErrorBoundary>
          <div className={styles.sectionGroup}>
            <h3 className={styles.sectionTitle}>
              파트별 실적 ({PERF_YEAR} {PERF_MONTH} 기준, 억원)
              <InfoButton>{INFO_PART_TABLE}</InfoButton>
            </h3>
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
        </ErrorBoundary>
      </div>

      {/* 실적 인사이트 */}
      <div className="fadeUp" style={{ animationDelay: '250ms' }}>
        <ErrorBoundary><PerformanceInsightSection info={INFO_INSIGHT} /></ErrorBoundary>
      </div>

      {/* 프로젝트 상세 */}
      <div className="fadeUp" style={{ animationDelay: '300ms' }}>
        <ErrorBoundary>
          <DataTable<PerfProject>
            data={vm.projects}
            columns={perfColumns as never}
            getRowId={(row) => String(row._row_num)}
            title="프로젝트 상세"
            info={INFO_PROJECT_TABLE}
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
            expandableRow={{
              getKey: (row) => String(row._row_num),
              excludeColumns: ['filename'],
              renderContent: (row, close) => <FinanceCrossCheckPanel projectCode={row.project_code} onClose={close} />,
            }}
          />
        </ErrorBoundary>
      </div>

      {/* 2depth: 재무 데이터 검색 결과 */}
      {vm.hasFinanceResults && (
        <ErrorBoundary>
          <FinanceSearchResults
            results={vm.financeResults}
            searchTerm={vm.financeSearchTerm}
            info={INFO_FINANCE_SEARCH}
          />
        </ErrorBoundary>
      )}

    </main>
  );
};

export default PerformancePage;
