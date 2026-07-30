import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useKpiPageViewModel } from '@/hooks/viewmodels/useKpiPageViewModel';
import { ChartCard, BarChart, DataTable, CopyText } from '@/components/ui';
import type { HideableColumn } from '@/components/ui/DataTable';
import type { KpiRawRow } from '@/types/kpi.types';
import type { KpiSummaryRow } from '@/hooks/viewmodels/useKpiPageViewModel';
import styles from './KpiPage.module.css';

// 취합 행 key — 모듈 스코프 (매 렌더 재생성 방지)
const getRawRowKey = (row: KpiRawRow): string | undefined => {
  const code = row['프로젝트코드'] ?? row['수행연도'] ?? row['파트명'];
  return code != null && String(code).trim() !== '' ? String(code) : undefined;
};

// KPI 집계 컬럼 — 모듈 스코프에서 한 번만 생성 (stable reference)
const sh = createColumnHelper<KpiSummaryRow>();
const summaryColumns = [
  sh.accessor('name',        { header: 'KPI 항목' }),
  sh.accessor('agg',         { header: '집계' }),
  sh.accessor('targetStr',   { header: '26년 목표', enableSorting: true }),
  sh.accessor('actual',      { header: '26년 실적', enableSorting: true }),
  sh.accessor('achieveRate', {
    header: '달성률',
    cell: i => {
      const row = i.row.original;
      return (
        <span style={{
          color: row.isGood ? 'var(--profit)' : 'var(--warn)',
          fontWeight: row.isGood ? 600 : undefined,
        }}>
          {row.achieveRate}
        </span>
      );
    },
  }),
];

// 취합 raw 컬럼 helper — 모듈 스코프 (stable)
const rh = createColumnHelper<KpiRawRow>();

const KpiPage = () => {
  const vm = useKpiPageViewModel();

  // rawColumns: rawCols가 바뀔 때만 재생성 (useMemo로 안정적 reference 보장)
  // 프로젝트코드 컬럼은 CopyText 적용 — 나머지는 기본 텍스트
  const rawColumns = useMemo(
    () => vm.rawCols.map(col =>
      rh.accessor(col as keyof KpiRawRow, {
        header: col,
        cell: i => {
          const v = i.getValue();
          if (v === null || v === undefined || v === 0 || v === '') return '-';
          if (col === '프로젝트코드' && typeof v === 'string' && v.trim())
            return <CopyText text={v} />;
          if (typeof v === 'number') return v.toLocaleString();
          return String(v);
        },
      })
    ),
    [vm.rawCols],
  );

  // 취합 숨김 가능 컬럼: PJ목표·PJ유사·비고 계열 (핵심 식별·실적 컬럼은 항상 표시)
  const rawHideableCols = useMemo((): HideableColumn[] =>
    vm.rawCols
      .filter(col => /PJ목표|PJ유사|비고/.test(col))
      .map(col => ({ id: col, label: col })),
    [vm.rawCols],
  );

  if (!vm.available) {
    return (
      <main className={styles.main}>
        <div className={styles.stub}>
          <div className={styles.icon}>📊</div>
          <h2 className={styles.title}>KPI 데이터</h2>
          <p className={styles.desc}>{vm.message ?? 'KPI 추출 스크립트를 먼저 실행해주세요.'}</p>
          <code className={styles.path}>extract_kpi_ppt.py 실행 → KPI 지표 데이터 추출.xlsx</code>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.mainFull}>

      {/* KPI 목표 vs 실적 차트 — ViewModel의 datasets 사용 */}
      <ChartCard>
        <ChartCard.Title>KPI 목표 vs 실적 (2026년)</ChartCard.Title>
        <ChartCard.Body>
          <div className={styles.chartWrap}>
            <BarChart
              labels={vm.chart.labels}
              datasets={vm.chart.datasets}
              options={{
                indexAxis: 'y',
                plugins: { datalabels: { display: false } },
                scales: { x: { ticks: { callback: v => Number(v).toLocaleString() } } },
              }}
            />
          </div>
        </ChartCard.Body>
      </ChartCard>

      {/* KPI 집계 — 8개 고정 항목이라 테이블 대신 카드 리스트 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>KPI 집계 (26년 목표 고정 / 실적 = 취합 기준 계산)</h3>
        <div className={styles.kpiList}>
          {vm.summaryRows.map(row => {
            const achievePct = row.achieveRate !== '-'
              ? Math.min(parseFloat(row.achieveRate), 150)
              : 0;
            return (
              <div key={row.name} className={styles.kpiRow}>
                <div className={styles.kpiName}>
                  <span className={styles.kpiBadge}>{row.agg}</span>
                  {row.name}
                </div>
                <div className={styles.kpiMeta}>
                  <div className={styles.kpiLabel}>목표</div>
                  <div className={styles.kpiValue}>{row.targetStr}</div>
                </div>
                <div className={styles.kpiMeta}>
                  <div className={styles.kpiLabel}>25년 실적</div>
                  <div className={styles.kpiValue}>{row.prevActual}</div>
                </div>
                <div className={styles.kpiMeta}>
                  <div className={styles.kpiLabel}>26년 실적</div>
                  <div className={styles.kpiValue}>{row.actual}</div>
                </div>
                <div className={styles.kpiAchieve}>
                  <div className={styles.kpiLabel}>달성률</div>
                  <div className={`${styles.kpiValue} ${row.isGood ? styles.cellProfit : styles.cellWarn}`}>
                    {row.achieveRate}
                  </div>
                  {row.achieveRate !== '-' && (
                    <div className={styles.achieveBar}>
                      <div
                        className={`${styles.achieveFill} ${row.isGood ? styles.achieveGood : styles.achievePoor}`}
                        style={{ width: `${achievePct}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* KPI 취합 */}
      {(vm.rawRows.length > 0 || vm.isLoading) && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            KPI 취합 ({vm.infiniteLoadMore.total}건)
          </h3>
          <DataTable<KpiRawRow>
            data={vm.rawRows}
            columns={rawColumns as never}
            getRowId={(row) => getRawRowKey(row) ?? String(Math.random())}
            isLoading={vm.isLoading}
            isFetching={vm.isFetchingNext}
            serverSearch={{
              value:    vm.searchValue,
              onChange: vm.onSearchChange,
            }}
            searchPlaceholder="프로젝트코드·파트명 검색…"
            infiniteLoadMore={vm.infiniteLoadMore}
            hideableColumns={rawHideableCols}
            emptyTitle="검색 결과가 없습니다."
          />
        </div>
      )}

    </main>
  );
};

export default KpiPage;
