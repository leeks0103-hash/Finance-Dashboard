// createColumnHelper·PerfPartRow — 파트별 실적 표 비활성으로 미사용, 복구 시 함께 해제
// import { createColumnHelper } from '@tanstack/react-table';
// import type { PerfPartRow } from '@/hooks/viewmodels/usePerformanceViewModel';
import { useState } from 'react';
import { usePerformanceViewModel } from '@/hooks/viewmodels/usePerformanceViewModel';
import { useFinanceCodes } from '@/hooks/useFinanceCodes';
import { DataTable, InfoButton } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FadeInSection } from '@/components/FadeInSection';
import PerfBreakdownModal from '@/components/features/PerfBreakdownModal/PerfBreakdownModal';
import type { PerfBreakdownTarget } from '@/hooks/viewmodels/usePerfBreakdownViewModel';
import PerformanceChartSection from '@/components/features/PerformanceChartSection/PerformanceChartSection';
import PerformanceKpiSection from '@/components/features/PerformanceKpiSection/PerformanceKpiSection';
import PerformanceInsightSection from '@/components/features/PerformanceInsightSection';
import PartAchievementBars from '@/components/features/PartAchievementBars/PartAchievementBars';
import { perfColumns, PERF_HIDEABLE_COLS, PERF_DEFAULT_HIDDEN } from '@/components/features/PerformanceTable/columns';
import FinanceCrossCheckPanel from '@/components/features/PerformanceTable/FinanceCrossCheckPanel';
import FinanceSearchResults from '@/components/features/PerformanceTable/FinanceSearchResults';
import type { PerfProject } from '@/types/performance.types';
// PERF_YEAR·stripPartPrefix·INFO_PART_TABLE — 파트별 실적 표 비활성으로 미사용, 복구 시 함께 해제
import { PERF_MONTH } from '@/utils';
import {
  INFO_ACHIEVEMENT_BARS,
  INFO_INSIGHT,
  INFO_PROJECT_TABLE,
  INFO_FINANCE_SEARCH,
} from '@/utils/infoTexts';
import styles from './PerformancePage.module.css';

// 프로젝트 병합 키는 백엔드 performance.py `_group_no` 가 계산해서 내려준다 (프론트 재구현 제거).

// ── 파트별 실적 표 — 비활성(주석 처리, 담당자 지정) ──────────────────────
// 사유: 한 표에 기준이 다른 값이 섞여 오독을 부름.
//   · 누계 기준 : 누계매출 · 누계원가 · 원가율        (1~기준월, BI~BP)
//   · 연간 기준 : 매출 계획 · 추정 실적 · 경상손익 · 손익률 (V·BH·BF)
//   누계매출(142.4억) 옆에 연간 경상손익(14.3억)이 놓여 14.3÷142.4=10.0%로 암산하기 쉬운데
//   실제 연간 손익률은 3.8%다(분자만 연간, 분모는 8개월).
//
// 복구 시 참고: 기준을 맞추기 위한 누계 경상손익·손익률은 백엔드에 이미 산출해 두었다
//   (performance.py `누계 기준 경상손익 재구성` → acc_operating_profit / acc_profit_rate,
//    by_part·total 모두 노출. ViewModel에도 accOperatingProfit / accProfitRate / isAccLoss 준비됨)
//   아래 컬럼 정의와 JSX 블록만 해제하면 누계·연간을 나란히 보여주는 형태로 되살아난다.
//
// const hp = createColumnHelper<PerfPartRow>();
// const profitCell = (value: string, loss: boolean) => (
//   <span style={{ color: loss ? 'var(--loss)' : 'var(--profit)', fontWeight: loss ? 600 : undefined }}>
//     {value}
//   </span>
// );
// const byPartColumns = [
//   hp.accessor('part', {
//     header: '파트', enableSorting: true,
//     cell: i => stripPartPrefix(i.getValue()),
//   }),
//   hp.accessor('planInitial',   { header: '매출 계획 (연간)', enableSorting: true }),
//   hp.accessor('junActual',     { header: `누계매출 (1~${PERF_MONTH})`, enableSorting: true }),
//   hp.accessor('junCost',       { header: `누계 원가 (1~${PERF_MONTH})` }),
//   hp.accessor('costRateStr',   { header: '원가율 (누계)' }),
//   hp.accessor('accOperatingProfit', {
//     header: `경상손익 (누계 1~${PERF_MONTH})`,
//     cell: i => profitCell(i.row.original.accOperatingProfit, i.row.original.isAccLoss),
//   }),
//   hp.accessor('accProfitRate', { header: '손익률 (누계)' }),
//   hp.accessor('junCheckTotal', { header: '추정 실적 (연간)' }),
//   hp.accessor('operatingProfit', {
//     header: '경상손익 (연간추정)',
//     cell: i => profitCell(i.row.original.operatingProfit, i.row.original.isLoss),
//   }),
//   hp.accessor('profitRate', { header: '손익률 (연간추정)' }),
//   hp.accessor('count',      { header: '건수', cell: i => String(i.getValue()) }),
// ];

const PerformancePage = () => {
  const vm = usePerformanceViewModel();
  // 재무 이력 보유 코드↔건수 — 프로젝트코드 셀의 배지용 (한 번 받아 캐시)
  const financeCodes = useFinanceCodes();
  // 파트별 매출 달성 현황 행 클릭 → 드릴다운 모달 (누계 실적 기준)
  const [achieveBreakdown, setAchieveBreakdown] = useState<PerfBreakdownTarget | null>(null);

  return (
    <main className={styles.main}>

      {/* KPI 카드 */}
      <FadeInSection delay={0}>
        <PerformanceKpiSection cards={vm.kpiCards} />
      </FadeInSection>

      {/* 차트 섹션 */}
      <FadeInSection delay={100}>
        <PerformanceChartSection />
      </FadeInSection>

      {/* 파트별 달성 현황 진행바 */}
      {vm.byPart.length > 0 && (
        <FadeInSection delay={150}>
          <PartAchievementBars
            rows={vm.byPart}
            month={PERF_MONTH}
            info={INFO_ACHIEVEMENT_BARS}
            onPartClick={part => setAchieveBreakdown({ chart: 'partAchievement', series: 0, key: part })}
          />
        </FadeInSection>
      )}

      {/* ── 파트별 실적 표 — 비활성(주석 처리, 담당자 지정) ──────────────────
          사유·복구 방법은 위 byPartColumns 주석 참고.
          아래 블록과 byPartColumns를 함께 해제하면 복구됨.
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
                getRowVariant={(row) => row.isAccLoss ? 'loss' : ''}
                defaultPageSize={10}
                pageSizeOptions={[10]}
                compact
                hideToolbar
                storageKey="performance-by-part-v2"
              />
            </div>
          </div>
        </ErrorBoundary>
      </div>
      ──────────────────────────────────────────────────────────────────── */}

      {/* 미수주 프로젝트 */}
      <FadeInSection delay={250}>
        <div className={styles.sectionGroup}>
          <h3 className={styles.sectionTitle}>
            미수주 프로젝트
            <InfoButton>{INFO_INSIGHT}</InfoButton>
          </h3>
          <div className={styles.section}>
            <PerformanceInsightSection />
          </div>
        </div>
      </FadeInSection>

      {/* 프로젝트 상세 */}
      <FadeInSection delay={300}>
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
            // 병합 묶음·NO. 둘 다 백엔드 _group_no 기준 (프론트 재계산 없음)
            mergeRowsByKey={(row) => String(row._group_no)}
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
      </FadeInSection>

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

      {achieveBreakdown && (
        <PerfBreakdownModal target={achieveBreakdown} onClose={() => setAchieveBreakdown(null)} />
      )}

    </main>
  );
};

export default PerformancePage;
