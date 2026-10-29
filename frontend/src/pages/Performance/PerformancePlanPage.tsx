import { usePerformancePlanViewModel } from '@/hooks/viewmodels/usePerformancePlanViewModel';
import { DataTable, FilterSelect, HrefDownloadButton, RefreshSpinner } from '@/components/ui';
import { FadeInSection } from '@/components/FadeInSection';
import PerformanceKpiSection from '@/components/features/PerformanceKpiSection/PerformanceKpiSection';
import PerformancePlanChartSection from '@/components/features/PerformancePlanChartSection/PerformancePlanChartSection';
import { perfPlanColumnSet } from '@/components/features/PerformanceTable/columns';
import { useUiStore } from '@/store';
import type { PerfProject } from '@/types/performance.types';
import styles from './PerformancePage.module.css';

// 카드 순서 저장 키 — 실적 보기와 카드 id가 같아서 따로 저장(안 나누면 서로 순서를 덮어씀)
const PLAN_KPI_ORDER_KEY = 'performance-kpi-order-plan27-v1';

const INFO_PLAN_TABLE =
  '2027년 사업계획 시트의 프로젝트당 한 줄(매출행 + 원가행). "26 추정"은 시트의 2026년 연간 추정, "27 계획"은 2027년 사업계획 합계 — ' +
  '증감 금액 = 27 계획 − 26 추정. 월별 값은 계획 분배이며 실적·재무 대조는 없습니다.';

/**
 * 경영실적 탭 — 2027 사업계획 보기(2026-10-29). 기준월·실적·달성률이 없는 시트라 카드·차트·표를 계획 기준으로 따로 구성.
 * 실적 보기의 파트별 매출 진행 현황·진도율·인원/인당·인사이트·재무 대조는 의미가 없어 없음.
 */
const PerformancePlanPage = () => {
  const vm = usePerformancePlanViewModel();
  const rawValues = useUiStore(s => s.showRawValues);
  const planCols = perfPlanColumnSet();

  return (
    <main className={styles.main}>
      <p className={styles.planNote}>
        {vm.yearLabel ? `${vm.yearLabel} ` : ''}사업계획 시트 기준 — 27 사업계획을 이 시트의 "2026년 연간 추정" 열과 비교합니다.
        월별 값은 계획 분배이며 실적·달성률은 없습니다.
        이 "26 추정"은 시트에 입력된 값이라 2026 실적 보기의 추정과 다를 수 있습니다.
      </p>

      <FadeInSection delay={0} tourId="perf-kpi" refreshing={vm.isSummaryFetching}>
        <PerformanceKpiSection cards={vm.kpiCards} orderKey={PLAN_KPI_ORDER_KEY} />
      </FadeInSection>

      <FadeInSection delay={100} tourId="perf-charts" refreshing={vm.isSummaryFetching}>
        <PerformancePlanChartSection chart={vm.chart} composition={vm.compositionView} />
      </FadeInSection>

      <FadeInSection delay={300} tourId="perf-projects">
        <DataTable<PerfProject>
          data={vm.projects}
          columns={planCols.columns as never}
          getRowId={(row) => String(row._row_num)}
          title="프로젝트 상세 (27 계획)"
          info={INFO_PLAN_TABLE}
          toolbarExtra={
            <HrefDownloadButton
              href={vm.exportHref}
              confirmText="지금 표의 필터·검색·정렬 그대로 전체 프로젝트를 받습니다."
              title="프로젝트 상세 엑셀 — 2027 사업계획"
            />
          }
          isLoading={vm.isLoading}
          isFetching={vm.isFetching}
          getRowVariant={(row) =>
            row.category !== '매출' ? ''
              : row.operating_profit < 0 ? 'loss'
              : row.profit_rate < 5 ? 'warn' : ''
          }
          hideableColumns={planCols.hideable}
          initialColumnVisibility={planCols.defaultHidden}
          getRowNumber={(row) => row._group_no}
          meta={{ rawValues, filterOptions: vm.filterOptions }}
          serverPagination={vm.serverPagination}
          serverSorting={vm.serverSorting}
          serverColumnFilters={vm.serverColumnFilters}
          serverSearch={vm.serverSearch}
          searchPlaceholder="프로젝트코드·이름·담당자 검색…"
          searchExtra={
            <FilterSelect
              value={vm.selectedProgress}
              onChange={vm.setProgress}
              options={vm.progressOptions}
              allLabel="진행단계 전체"
            />
          }
          emptyIcon="search"
          emptyTitle="검색 결과 없음"
          emptyDescription="다른 검색어나 필터 조건을 시도해보세요."
          storageKey="performance-plan-project-v1"
          sizeVersion={1}
          visibilityVersion={1}
        />
      </FadeInSection>

      <RefreshSpinner active={vm.isSummaryFetching} />
    </main>
  );
};

export default PerformancePlanPage;
