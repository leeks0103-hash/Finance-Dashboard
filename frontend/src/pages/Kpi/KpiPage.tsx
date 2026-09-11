import { useEffect, useMemo, useState } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useKpiPageViewModel } from '@/hooks/viewmodels/useKpiPageViewModel';
import { useKpiFilterOptions } from '@/hooks/useKpiFilterOptions';
import { useKpiFilterStore } from '@/store/kpiFilter.store';
import { sortStages } from '@/utils/stageOrder';
import { ChartCard, BarChart, DataTable, CopyText, HighlightText, Button, Spinner, QueryGate, FilterSelect } from '@/components/ui';
import { FadeInSection } from '@/components/FadeInSection';
import KpiRawTable from '@/components/features/KpiRawTable/KpiRawTable';
import KpiBreakdownModal from '@/components/features/KpiBreakdownModal/KpiBreakdownModal';
import { kpiColLabel } from '@/utils/kpiColumns';
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

// 목표/실적/전년 셀 공통 — "신규:N건/기존:N건"이면 분할, 아니면 그대로
const KpiValueCell = ({ value }: { value: string }) =>
  /신규/.test(value) ? <CountCell value={value} /> : <>{value}</>;

// KPI 집계 컬럼 — 모듈 스코프 (stable)
const sh = createColumnHelper<KpiSummaryRow>();
const summaryColumns = [
  // KPI 항목·사업계획 목표는 필터와 무관한 고정값 — staticCol 음영으로 변동 컬럼과 구분
  sh.accessor('name',       { header: 'KPI 항목', size: 420, meta: { staticCol: true } }),
  // 사업계획 목표는 고정값(ViewModel PLAN_TARGETS) — 프로젝트 목표와 구분되도록 헤더에 명시
  sh.accessor('planTarget', { header: '26년 목표(사업계획)', size: 170, meta: { staticCol: true } }),
  sh.accessor('agg',        { header: '집계방식', size: 110 }),
  sh.accessor('targetStr',  { header: '26년 목표(프로젝트)', size: 190, enableSorting: true,
    cell: i => <KpiValueCell value={i.getValue() as string} />,
  }),
  sh.accessor('actual',     { header: '26년 실적', size: 220, enableSorting: true,
    cell: i => <KpiValueCell value={i.getValue() as string} />,
  }),
  sh.accessor('prevActual', { header: '25년 실적', size: 220, enableSorting: true,
    cell: i => <KpiValueCell value={i.getValue() as string} />,
  }),
];

// flat 취합 컬럼 helper — 모듈 스코프
const rh = createColumnHelper<KpiRawRow>();

const KpiPage = () => {
  // ── 필터 A: KPI 목표 vs 실적 차트 + KPI 집계 표에만 적용 (취합 표와 완전 별개) ──
  const [summaryPart, setSummaryPart] = useState('');
  const vm = useKpiPageViewModel(summaryPart);
  const [rawView, setRawView] = useState<'flat' | 'rowspan'>('flat');
  // KPI 목표 vs 실적 막대 클릭 → 드릴다운 모달 (0=목표, 1=실적)
  const [breakdown, setBreakdown] = useState<{ name: string; metric: 'target' | 'actual' } | null>(null);

  // 드롭박스 옵션 — "-"(파트/단계 미인식)는 목록에서만 제외. 표에는 그 행도 그대로 나옴
  const { data: filterOpts } = useKpiFilterOptions();
  const partOptions  = useMemo(() => (filterOpts?.parts ?? []).filter(p => p && p !== '-'), [filterOpts]);
  const stageOptions = useMemo(() => sortStages((filterOpts?.stages ?? []).filter(s => s && s !== '-')), [filterOpts]);

  // ── 필터 B: KPI 취합 표에만 적용 (useKpiFilterStore, 단일선택). 칩 필터바 제거 대체 ──
  const rawParts  = useKpiFilterStore(s => s.parts);
  const rawStages = useKpiFilterStore(s => s.stages);
  // KpiFilterBar(=syncOptions) 제거로 자동 초기화가 없어짐 — persist된 옛 선택값(전체 파트 등)이
  // "-" 행까지 걸러버리지 않도록 진입 시 1회 비움. 이후엔 아래 셀렉트로만 조작.
  useEffect(() => {
    useKpiFilterStore.setState({ years: [], parts: [], stages: [] });
  }, []);
  const rawPartVal  = rawParts.length === 1 ? rawParts[0] : '';
  const rawStageVal = rawStages.length === 1 ? rawStages[0] : '';
  const setRawPart  = (v: string) => {
    useKpiFilterStore.setState({ parts: v ? [v] : [] });
    vm.serverPagination.onPageChange(1);
  };
  const setRawStage = (v: string) => {
    useKpiFilterStore.setState({ stages: v ? [v] : [] });
    vm.serverPagination.onPageChange(1);
  };

  // flat 뷰 컬럼 — rawCols 변경 시에만 재생성
  const rawColumns = useMemo(
    () => vm.rawCols.map(col =>
      rh.accessor(col as keyof KpiRawRow, {
        header: kpiColLabel(col),
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
      .map(c => ({ id: c, label: kpiColLabel(c) })),
    ...vm.rawCols
      .filter(c => /처리일시|최종수정/.test(c))
      .map(c => ({ id: c, label: kpiColLabel(c) })),
  ], [vm.rawCols]);

  const rawInitialHidden = useMemo(() =>
    Object.fromEntries(
      vm.rawCols
        .filter(c => /PJ유사|사업계획|처리일시|최종수정/.test(c))
        .map(c => [c, false])
    ),
  [vm.rawCols]);

  // 로딩 / 데이터없음 / 정상 분기 — QueryGate가 우선순위(loading > empty)를 강제해
  // "로딩 중인데 스텁이 먼저 뜨는" 문제를 구조적으로 막는다
  const emptyView = (
    <main className={styles.main}>
      <div className={styles.stub}>
        <div className={styles.icon}>📊</div>
        <h2 className={styles.title}>KPI 데이터</h2>
        <p className={styles.desc}>{vm.message ?? 'KPI 추출 스크립트를 먼저 실행해주세요.'}</p>
        <code className={styles.path}>extract_kpi_ppt.py 실행 → KPI 지표 데이터 추출.xlsx</code>
      </div>
    </main>
  );

  return (
    <QueryGate
      loading={vm.isLoading && !vm.available}
      empty={!vm.available}
      loadingView={<main className={styles.main}><Spinner label="KPI 데이터 불러오는 중…" /></main>}
      emptyView={emptyView}
    >
    <main className={styles.mainFull}>

      {/* KPI 목표 vs 실적 차트 — 제목줄 안에 파트 필터(A). 이 필터는 차트 + KPI 집계 표에만 적용 */}
      <FadeInSection delay={0}>
          <ChartCard compact={false}>
            <ChartCard.Title>
              <div className={styles.titleWithFilter}>
                <span>KPI 목표 vs 실적 (2026년)</span>
                <FilterSelect
                  label="파트"
                  value={summaryPart}
                  onChange={setSummaryPart}
                  options={partOptions}
                />
              </div>
            </ChartCard.Title>
            <ChartCard.Body>
              <div className={styles.chartWrap} style={{ height: Math.max(480, vm.chart.labels.length * 66) }}>
                <BarChart
                  labels={vm.chart.labels}
                  datasets={vm.chart.datasets}
                  onClick={(label, dsIndex) =>
                    // 0=목표KPI, 1=프로젝트목표 → target / 2=실적 → actual (축 라벨 클릭 -1도 actual)
                    setBreakdown({ name: label, metric: dsIndex === 0 || dsIndex === 1 ? 'target' : 'actual' })
                  }
                  options={{
                    indexAxis: 'y',
                    ...vm.chart.options,
                    scales: {
                      x: {
                        max: vm.chart.xMax,   // 최댓값보다 살짝 위, 5 단위로 올림 (막대·수치가 축 끝에 안 붙게)
                        ticks: { color: vm.chart.tickColor, callback: v => Number(v).toLocaleString() },
                      },
                      y: { ticks: {
                        color: vm.chart.tickColor,
                        callback: function (this: { chart: { width: number } }, _value: unknown, index: number) {
                          const label = vm.chart.labels[index] ?? '';
                          const maxChars = Math.max(6, Math.floor((this.chart.width * 0.4) / 13));
                          return label.length > maxChars ? `…${label.slice(-(maxChars - 1))}` : label;
                        },
                      } },
                    },
                  }}
                />
              </div>
            </ChartCard.Body>
          </ChartCard>
      </FadeInSection>

      {/* KPI 집계 — 검색·정렬 활성화 */}
      <FadeInSection delay={100}>
          <DataTable<KpiSummaryRow>
            data={vm.summaryRows}
            columns={summaryColumns as never}
            getRowId={row => row.name}
            title="KPI 집계"
            hideCount
            compact
            staticColShade="soft"
            defaultPageSize={10}
            pageSizeOptions={[10]}
            storageKey="kpi-summary-v3"   /* 컬럼 순서 변경 — 저장된 순서·폭 1회 초기화 */
            sizeVersion={3}   /* 반복 축소로 망가진 저장 폭 1회 초기화 (compact fit 버그 수정 후) */
          />
      </FadeInSection>

      {/* KPI 취합 — flat / rowspan 토글 (툴바에 통합) */}
      <FadeInSection delay={200}>
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
            // 파트/보고단계 필터(B) — 검색범위 셀렉트와 검색 입력창 사이
            const rawFilters = (
              <div className={styles.toolbarFilters}>
                <FilterSelect value={rawPartVal}  onChange={setRawPart}  options={partOptions}  allLabel="파트 전체" />
                <FilterSelect value={rawStageVal} onChange={setRawStage} options={stageOptions} allLabel="보고단계 전체" />
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
                searchExtra={rawFilters}
              />
            ) : (
              <KpiRawTable
                data={vm.rawRows}
                title="KPI 취합"
                isLoading={vm.isLoading}
                isFetching={vm.isFetching}
                serverPagination={vm.serverPagination}
                serverSearch={vm.serverSearch}
                toolbarExtra={<>{rawFilters}{viewToggle}</>}
              />
            );
          })()}
      </FadeInSection>

      {breakdown && (
        <KpiBreakdownModal
          name={breakdown.name}
          metric={breakdown.metric}
          onClose={() => setBreakdown(null)}
        />
      )}

    </main>
    </QueryGate>
  );
};

export default KpiPage;
