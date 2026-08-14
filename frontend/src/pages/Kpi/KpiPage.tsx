import { useMemo, useState } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useKpiPageViewModel } from '@/hooks/viewmodels/useKpiPageViewModel';
import { ChartCard, BarChart, DataTable, CopyText, HighlightText, Button } from '@/components/ui';
import KpiRawTable from '@/components/features/KpiRawTable/KpiRawTable';
import type { KpiRawRow } from '@/types/kpi.types';
import type { KpiSummaryRow } from '@/hooks/viewmodels/useKpiPageViewModel';
import styles from './KpiPage.module.css';

// 신규:N건/기존:N건 패턴을 뱃지 2개로 분할 렌더링
function CountCell({ value }: { value: string }) {
  const m = value.match(/신규\s*:\s*(\d+)건[/／]기존\s*:\s*(\d+)건/);
  if (m) return <span>신규:{m[1]}건 / 기존:{m[2]}건</span>;
  const m2 = value.match(/신규\s*:\s*(\d+)건/);
  if (m2) return <span>신규:{m2[1]}건</span>;
  return <>{value}</>;
}

// KPI 집계 컬럼 — 모듈 스코프 (stable)
const sh = createColumnHelper<KpiSummaryRow>();
const summaryColumns = [
  sh.accessor('name',       { header: 'KPI 항목' }),
  sh.accessor('agg',        { header: '집계방식' }),
  sh.accessor('targetStr',  { header: '26년 목표', enableSorting: true,
    cell: i => { const v = i.getValue() as string; return /신규/.test(v) ? <CountCell value={v} /> : <>{v}</>; },
  }),
  sh.accessor('actual',     { header: '26년 실적', enableSorting: true,
    cell: i => { const v = i.getValue() as string; return /신규/.test(v) ? <CountCell value={v} /> : <>{v}</>; },
  }),
  sh.accessor('prevActual', { header: '25년 실적', enableSorting: true,
    cell: i => { const v = i.getValue() as string; return /신규/.test(v) ? <CountCell value={v} /> : <>{v}</>; },
  }),
];

// flat 취합 컬럼 helper — 모듈 스코프
const rh = createColumnHelper<KpiRawRow>();

const KpiPage = () => {
  const vm = useKpiPageViewModel();
  const [rawView, setRawView] = useState<'flat' | 'rowspan'>('flat');

  // flat 뷰 컬럼 — rawCols 변경 시에만 재생성
  const rawColumns = useMemo(
    () => vm.rawCols.map(col =>
      rh.accessor(col as keyof KpiRawRow, {
        header: col,
        cell: i => {
          const v = i.getValue();
          if (v === null || v === undefined || v === 0 || v === '') return '-';
          const query = i.table.options.meta?.searchQuery;
          if (col === '프로젝트코드' && typeof v === 'string' && v.trim())
            return <CopyText text={v} highlight={query} />;
          return <HighlightText text={String(v)} query={query} />;
        },
      })
    ),
    [vm.rawCols],
  );

  // flat 뷰 숨김 가능 컬럼 — PJ유사·사업계획 계열은 기본 숨김
  const rawHideableCols = useMemo(() => [
    ...vm.rawCols
      .filter(c => /PJ유사|사업계획/.test(c))
      .map(c => ({ id: c, label: c })),
    ...vm.rawCols
      .filter(c => /처리일시|최종수정/.test(c))
      .map(c => ({ id: c, label: c })),
  ], [vm.rawCols]);

  const rawInitialHidden = useMemo(() =>
    Object.fromEntries(
      vm.rawCols
        .filter(c => /PJ유사|사업계획|처리일시|최종수정/.test(c))
        .map(c => [c, false])
    ),
  [vm.rawCols]);

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

      {/* KPI 목표 vs 실적 차트 */}
      <ChartCard>
        <ChartCard.Title>KPI 목표 vs 실적 (2026년)</ChartCard.Title>
        <ChartCard.Body>
          <div className={styles.chartWrap} style={{ height: Math.max(320, vm.chart.labels.length * 40) }}>
            <BarChart
              labels={vm.chart.labels}
              datasets={vm.chart.datasets}
              options={{
                indexAxis: 'y',
                ...vm.chart.options,
                scales: { x: { ticks: { callback: v => Number(v).toLocaleString() } } },
              }}
            />
          </div>
        </ChartCard.Body>
      </ChartCard>

      {/* KPI 집계 — 검색·정렬 활성화 */}
      <DataTable<KpiSummaryRow>
        data={vm.summaryRows}
        columns={summaryColumns as never}
        getRowId={row => row.name}
        title="KPI 집계"
        hideCount
        compact
        defaultPageSize={10}
        pageSizeOptions={[10]}
        storageKey="kpi-summary"
      />

      {/* KPI 취합 — flat / rowspan 토글 (툴바에 통합) */}
      {(() => {
        const viewToggle = (
          <div className={styles.viewToggle}>
            <Button variant="ghost" size="sm"
              className={`${styles.toggleBtn} ${rawView === 'flat' ? styles.toggleActive : ''}`}
              onClick={() => setRawView('flat')}
            >목록</Button>
            <Button variant="ghost" size="sm"
              className={`${styles.toggleBtn} ${rawView === 'rowspan' ? styles.toggleActive : ''}`}
              onClick={() => setRawView('rowspan')}
            >KPI 상세</Button>
          </div>
        );
        return rawView === 'flat' ? (
          <DataTable<KpiRawRow>
            data={vm.rawRows}
            columns={rawColumns as never}
            getRowId={row => String(row['_row_num'])}
            title="KPI 취합"
            isLoading={vm.isLoading}
            isFetching={vm.isFetching}
            serverPagination={vm.serverPagination}
            serverSearch={vm.serverSearch}
            searchPlaceholder="프로젝트코드·파트명 검색…"
            hideableColumns={rawHideableCols}
            initialColumnVisibility={rawInitialHidden}
            emptyIcon="🔍"
            emptyTitle="검색 결과 없음"
            emptyDescription="다른 검색어나 필터 조건을 시도해보세요."
            storageKey="kpi-raw-flat"
            toolbarExtra={viewToggle}
            copyableColumns={['파일명']}
          />
        ) : (
          <KpiRawTable
            data={vm.rawRows}
            title="KPI 취합"
            isLoading={vm.isLoading}
            isFetching={vm.isFetching}
            serverPagination={vm.serverPagination}
            serverSearch={vm.serverSearch}
            toolbarExtra={viewToggle}
          />
        );
      })()}

    </main>
  );
};

export default KpiPage;
