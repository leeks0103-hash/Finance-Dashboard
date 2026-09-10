import { createColumnHelper } from '@tanstack/react-table';
import { usePerformanceViewModel } from '@/hooks/viewmodels/usePerformanceViewModel';
import type { PerfPartRow } from '@/hooks/viewmodels/usePerformanceViewModel';
import { useFinanceCodes } from '@/hooks/useFinanceCodes';
import { DataTable, InfoButton } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import PerformanceChartSection from '@/components/features/PerformanceChartSection/PerformanceChartSection';
import PerformanceKpiSection from '@/components/features/PerformanceKpiSection/PerformanceKpiSection';
import PerformanceInsightSection from '@/components/features/PerformanceInsightSection';
import PartAchievementBars from '@/components/features/PartAchievementBars/PartAchievementBars';
import { perfColumns, PERF_HIDEABLE_COLS, PERF_DEFAULT_HIDDEN } from '@/components/features/PerformanceTable/columns';
import FinanceCrossCheckPanel from '@/components/features/PerformanceTable/FinanceCrossCheckPanel';
import FinanceSearchResults from '@/components/features/PerformanceTable/FinanceSearchResults';
import type { PerfProject } from '@/types/performance.types';
import { PERF_YEAR, PERF_MONTH, stripPartPrefix } from '@/utils';
import {
  INFO_ACHIEVEMENT_BARS,
  INFO_PART_TABLE,
  INFO_INSIGHT,
  INFO_PROJECT_TABLE,
  INFO_FINANCE_SEARCH,
} from '@/utils/infoTexts';
import styles from './PerformancePage.module.css';

// 프로젝트 병합 키 — 백엔드 performance.py `_group_no` 와 같은 규칙을 유지해야 함.
// 정식 코드(영문 1자 + 숫자 10자 이상)는 코드만으로 묶는다: 매출행/원가행 프로젝트명이
// 원본 엑셀에서 다르게 입력된 경우(H093600126020002 "홍보 자료" vs "안내 자료")에도 한 묶음이 되도록.
// 정식 코드가 아닌 placeholder("생성예정"/"드롭"/"미생성" 등)는 서로 다른 프로젝트가 같은
// 텍스트를 공유하므로 project_name까지 함께 봐야 한다.
const REAL_CODE = /^[A-Za-z]\d{10,}$/;
const perfGroupKey = (row: PerfProject) => {
  const code = String(row.project_code ?? '').trim();
  return REAL_CODE.test(code) ? code : `${code}␟${row.project_name}`;
};

// ── 파트별 실적 컬럼 ─────────────────────────────────────────────────────
// 이 표는 기준이 다른 두 종류의 값을 함께 싣는다. 헤더에 기준을 반드시 명시할 것.
//   · 누계(1~기준월) : 누계매출 · 누계원가 · 원가율 · 누계 경상손익 · 누계 손익률
//   · 연간 추정      : 매출 계획 · 추정 실적 · 경상손익 · 손익률
// 예전에는 누계 컬럼 옆에 연간 경상손익만 있어서 14.3÷142.4=10.0% 처럼 기간이 어긋난
// 암산을 유발했다(실제 연간 손익률 3.8%). 지금은 누계 손익을 따로 계산해 나란히 둔다.
// 누계 경상손익 산출 근거는 performance.py load_perf_excel()의 '누계 기준 경상손익 재구성' 참고.
const hp = createColumnHelper<PerfPartRow>();
const profitCell = (value: string, loss: boolean) => (
  <span style={{ color: loss ? 'var(--loss)' : 'var(--profit)', fontWeight: loss ? 600 : undefined }}>
    {value}
  </span>
);
const byPartColumns = [
  hp.accessor('part', {
    header: '파트', enableSorting: true,
    cell: i => stripPartPrefix(i.getValue()),
  }),
  hp.accessor('planInitial',   { header: '매출 계획 (연간)', enableSorting: true }),
  hp.accessor('junActual',     { header: `누계매출 (1~${PERF_MONTH})`, enableSorting: true }),
  hp.accessor('junCost',       { header: `누계 원가 (1~${PERF_MONTH})` }),
  hp.accessor('costRateStr',   { header: '원가율 (누계)' }),
  hp.accessor('accOperatingProfit', {
    header: `경상손익 (누계 1~${PERF_MONTH})`,
    cell: i => profitCell(i.row.original.accOperatingProfit, i.row.original.isAccLoss),
  }),
  hp.accessor('accProfitRate', { header: '손익률 (누계)' }),
  hp.accessor('junCheckTotal', { header: '추정 실적 (연간)' }),
  hp.accessor('operatingProfit', {
    header: '경상손익 (연간추정)',
    cell: i => profitCell(i.row.original.operatingProfit, i.row.original.isLoss),
  }),
  hp.accessor('profitRate', { header: '손익률 (연간추정)' }),
  hp.accessor('count',      { header: '건수', cell: i => String(i.getValue()) }),
];

const PerformancePage = () => {
  const vm = usePerformanceViewModel();
  // 재무 이력 보유 코드↔건수 — 프로젝트코드 셀의 배지용 (한 번 받아 캐시)
  const financeCodes = useFinanceCodes();

  return (
    <main className={styles.main}>

      {/* KPI 카드 */}
      <div className="fadeUp" style={{ animationDelay: '0ms' }}>
        <ErrorBoundary>
          <PerformanceKpiSection cards={vm.kpiCards} />
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
              파트별 실적 ({PERF_YEAR}, 억원) — 누계 1~{PERF_MONTH} / 추정 연간
              <InfoButton>{INFO_PART_TABLE}</InfoButton>
            </h3>
            <div className={styles.section}>
              <DataTable<PerfPartRow>
                data={vm.byPart}
                columns={byPartColumns as never}
                getRowId={(row) => row.part}
                /* 손실 표시는 누계 기준 — 표 제목이 누계를 먼저 말하므로 기준을 맞춘다 */
                getRowVariant={(row) => row.isAccLoss ? 'loss' : ''}
                defaultPageSize={10}
                pageSizeOptions={[10]}
                compact
                hideToolbar
                /* v2 — 컬럼 2개 추가로 저장된 폭·순서 1회 초기화 */
                storageKey="performance-by-part-v2"
              />
            </div>
          </div>
        </ErrorBoundary>
      </div>

      {/* 미수주 프로젝트 */}
      <div className="fadeUp" style={{ animationDelay: '250ms' }}>
        <ErrorBoundary>
          <div className={styles.sectionGroup}>
            <h3 className={styles.sectionTitle}>
              미수주 프로젝트
              <InfoButton>{INFO_INSIGHT}</InfoButton>
            </h3>
            <div className={styles.section}>
              <PerformanceInsightSection />
            </div>
          </div>
        </ErrorBoundary>
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
              // 손익 지표는 매출 행에만 있음 — 원가 행은 0이라 그냥 두면 전부 warn으로 칠해짐
              row.category !== '매출' ? ''
                : row.operating_profit < 0 ? 'loss'
                : row.profit_rate < 5 ? 'warn' : ''
            }
            hideableColumns={PERF_HIDEABLE_COLS}
            initialColumnVisibility={PERF_DEFAULT_HIDDEN}
            // 백엔드 _group_no와 반드시 같은 규칙이어야 병합 묶음과 NO.가 어긋나지 않음
            mergeRowsByKey={perfGroupKey}
            getRowNumber={(row) => row._group_no}
            // 20자 넘는 셀은 클릭 시 전체 내용 팝업(오버레이)이 먼저 떠서 더블클릭이 td까지 도달하지 못함 —
            // 안내 문구도 실제 동작(짧은 셀만 펼침)에 맞춰 적어 둔다
            hint="프로젝트코드 옆 숫자 배지 = 재무 이력 건수. 짧은 셀(프로젝트코드·담당자)을 더블클릭하면 아래에 펼쳐집니다. (프로젝트명·비고처럼 글이 긴 셀은 클릭하면 전체 내용 팝업이 열립니다)"
            /* 프로젝트코드 셀이 재무 이력 건수 배지를 그릴 수 있도록 코드↔건수 맵 전달 */
            meta={{ financeCodes: financeCodes.data }}
            serverPagination={vm.serverPagination}
            serverSearch={vm.serverSearch}
            searchPlaceholder="프로젝트코드·이름·담당자 검색…"
            emptyIcon="🔍"
            emptyTitle="검색 결과 없음"
            emptyDescription="다른 검색어나 필터 조건을 시도해보세요."
            storageKey="performance-project"
            // 글씨 많은 컬럼(프로젝트명·사유·중복점검 등) 기본 폭을 넓히면서 저장된 폭 1회 무효화
            sizeVersion={2}
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
