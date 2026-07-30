import { useMemo } from 'react';
import { usePerformanceViewModel } from '@/hooks/viewmodels/usePerformanceViewModel';
import { ChartCard, BarChart, DataTable } from '@/components/ui';
import { perfColumns, PERF_HIDEABLE_COLS } from '@/components/features/PerformanceTable/columns';
import { formatEok } from '@/utils';
import styles from './PerformancePage.module.css';

const PerformancePage = () => {
  const vm = usePerformanceViewModel();

  // footer 합계 — useMemo로 매 렌더 재계산 방지
  const footer = useMemo(() => {
    if (!vm.projects.length) return undefined;
    const plan     = vm.projects.reduce((s, r) => s + r.plan_initial, 0);
    const junAct   = vm.projects.reduce((s, r) => s + r.jun_actual, 0);
    const opProfit = vm.projects.reduce((s, r) => s + r.operating_profit, 0);
    return {
      project_code:     <span style={{ fontWeight: 700 }}>합계</span>,
      plan_initial:     formatEok(plan),
      jun_actual:       formatEok(junAct),
      operating_profit: (
        <span style={{ color: opProfit < 0 ? 'var(--loss)' : 'var(--profit)', fontWeight: 600 }}>
          {formatEok(opProfit)}
        </span>
      ),
    };
  }, [vm.projects]);

  return (
    <main className={styles.main}>

      {/* KPI 카드 */}
      <div className={styles.kpiGrid}>
        {vm.kpiCards.map(card => (
          <div key={card.label} className={`${styles.kpiCard} ${styles[card.accent]}`}>
            <div className={styles.kpiLabel}>{card.label}</div>
            <div className={styles.kpiValue}>{card.value}</div>
            <div className={styles.kpiSub}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* 월별 실적 차트 */}
      <ChartCard>
        <ChartCard.Title>월별 실적 현황 (6월 점검 기준, 억원)</ChartCard.Title>
        <ChartCard.Body>
          <div className={styles.chartWrap}>
            <BarChart
              labels={vm.chartLabels}
              datasets={vm.chartDatasets}
              options={{
                plugins: { datalabels: { display: false } },
                scales:  { y: { ticks: { callback: v => v + '억' } } },
              }}
            />
          </div>
        </ChartCard.Body>
      </ChartCard>

      {/* 파트별 실적 — DataTable (7행 고정, 페이지네이션 없음) */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>파트별 실적 (2026년 6월 기준, 억원)</h3>
        <DataTable
          data={vm.byPart as unknown as Record<string, unknown>[]}
          columns={[
            {
              accessorKey: 'part', header: '파트', enableSorting: true,
              cell: (i: { getValue: () => unknown }) =>
                String(i.getValue()).replace(/^[①-⑦]\s*/, ''),
            },
            { accessorKey: 'planInitial',   header: '매출 계획',    enableSorting: true },
            { accessorKey: 'junActual',     header: '6월 실적',     enableSorting: true },
            { accessorKey: 'junCost',       header: '6월 원가' },
            { accessorKey: 'costRateStr',   header: '원가율' },
            { accessorKey: 'junCheckTotal', header: '6월 점검 연간' },
            {
              accessorKey: 'operatingProfit',
              header: '경상손익',
              cell: (i: { getValue: () => unknown; row: { original: unknown } }) => {
                const row = i.row.original as { isLoss: boolean; operatingProfit: string };
                return (
                  <span style={{ color: row.isLoss ? 'var(--loss)' : 'var(--profit)', fontWeight: row.isLoss ? 600 : undefined }}>
                    {row.operatingProfit}
                  </span>
                );
              },
            },
            { accessorKey: 'profitRate', header: '손익률' },
            { accessorKey: 'count',      header: '건수' },
          ] as never}
          getRowId={(row) => String((row as { part: string }).part)}
          getRowVariant={(row) => (row as { isLoss: boolean }).isLoss ? 'loss' : ''}
          defaultPageSize={10}
          pageSizeOptions={[10]}
          compact
          hideToolbar
        />
      </div>

      {/* 프로젝트 상세 — ViewModel의 projects 사용 (직접 훅 호출 제거) */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>프로젝트 상세 (단위: 억원 / 원가율·손익률: %)</h3>
        <DataTable
          data={vm.projects}
          columns={perfColumns as never}
          getRowId={(row) => String(row._row_num)}
          isLoading={vm.isLoading}
          isFetching={vm.isFetching}
          stickyFirstCol
          searchable
          searchPlaceholder="프로젝트코드·이름·담당자 검색…"
          defaultPageSize={30}
          getRowVariant={(row) =>
            row.operating_profit < 0 ? 'loss' : row.profit_rate < 5 ? 'warn' : ''
          }
          footer={footer}
          hideableColumns={PERF_HIDEABLE_COLS}
          emptyIcon="🔍"
          emptyTitle="검색 결과 없음"
          emptyDescription="다른 검색어나 필터 조건을 시도해보세요."
        />
      </div>

    </main>
  );
};

export default PerformancePage;
