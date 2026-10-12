// createColumnHelper·PerfPartRow — 파트별 실적 표 비활성으로 미사용, 복구 시 함께 해제
// import { createColumnHelper } from '@tanstack/react-table';
// import type { PerfPartRow } from '@/hooks/viewmodels/usePerformanceViewModel';
import { useState } from 'react';
import { usePerformanceViewModel } from '@/hooks/viewmodels/usePerformanceViewModel';
import { useFinanceCodes } from '@/hooks/useFinanceCodes';
import { DataTable, InfoButton, FilterSelect } from '@/components/ui';
// ErrorBoundary — 재무 검색 결과 섹션 비활성으로 미사용, 복구 시 함께 해제
// import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FadeInSection } from '@/components/FadeInSection';
import PerfBreakdownModal from '@/components/features/PerfBreakdownModal/PerfBreakdownModal';
import type { PerfBreakdownTarget } from '@/hooks/viewmodels/usePerfBreakdownViewModel';
import PerformanceChartSection from '@/components/features/PerformanceChartSection/PerformanceChartSection';
import PerformanceKpiSection from '@/components/features/PerformanceKpiSection/PerformanceKpiSection';
import PerformanceInsightSection from '@/components/features/PerformanceInsightSection';
import PartAchievementBars from '@/components/features/PartAchievementBars/PartAchievementBars';
import { perfColumnSet } from '@/components/features/PerformanceTable/columns';
import FinanceCrossCheckPanel from '@/components/features/PerformanceTable/FinanceCrossCheckPanel';
// FinanceSearchResults·INFO_FINANCE_SEARCH — 재무 검색 결과 섹션 비활성(아래 주석), 복구 시 함께 해제
// import FinanceSearchResults from '@/components/features/PerformanceTable/FinanceSearchResults';
import { useUiStore } from '@/store';
import type { PerfProject } from '@/types/performance.types';
// PERF_YEAR·stripPartPrefix·INFO_PART_TABLE — 파트별 실적 표 비활성으로 미사용, 복구 시 함께 해제
import {
  infoAchievementBars,
  INFO_INSIGHT,
  INFO_PROJECT_TABLE,
  // INFO_FINANCE_SEARCH,
} from '@/utils/infoTexts';
import styles from './PerformancePage.module.css';

// 프로젝트당 한 줄 + 일련번호(_group_no)는 백엔드 performance.py `_merge_rev_cost_rows`가 만들어 내려준다.

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
  // 프로젝트 상세 컬럼 — 머리글의 "N월 실적"이 실제로 읽은 시트의 기준월을 따름
  const finCompare = useUiStore(s => s.showFinCompare);
  const perfCols = perfColumnSet(vm.period.month, finCompare);
  const rawValues = useUiStore(s => s.showRawValues);
  // 재무 이력 보유 코드↔건수 — 프로젝트코드 셀의 배지용 (한 번 받아 캐시)
  const financeCodes = useFinanceCodes();
  // 파트별 매출 달성 현황 행 클릭 → 드릴다운 모달 (누계 실적 기준)
  const [achieveBreakdown, setAchieveBreakdown] = useState<PerfBreakdownTarget | null>(null);

  return (
    <main className={styles.main}>

      {/* KPI 카드 */}
      <FadeInSection delay={0} tourId="perf-kpi">
        <PerformanceKpiSection cards={vm.kpiCards} />
      </FadeInSection>

      {/* 차트 섹션 */}
      <FadeInSection delay={100} tourId="perf-charts">
        <PerformanceChartSection />
      </FadeInSection>

      {/* 파트별 달성 현황 진행바 */}
      {vm.byPart.length > 0 && (
        <FadeInSection delay={150} tourId="perf-achievement">
          <PartAchievementBars
            rows={vm.byPart}
            month={vm.period.month}
            info={infoAchievementBars(vm.period.actualRange)}
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
      <FadeInSection delay={250} tourId="perf-missed">
        <div className={styles.sectionGroup}>
          <h3 className={styles.sectionTitle}>
            미수주 프로젝트
            <InfoButton>{INFO_INSIGHT}</InfoButton>
          </h3>
          <PerformanceInsightSection />
        </div>
      </FadeInSection>

      {/* 프로젝트 상세 */}
      <FadeInSection delay={300} tourId="perf-projects">
          <DataTable<PerfProject>
            data={vm.projects}
            columns={perfCols.columns as never}
            getRowId={(row) => String(row._row_num)}
            title="프로젝트 상세"
            info={INFO_PROJECT_TABLE}
            isLoading={vm.isLoading}
            isFetching={vm.isFetching}
            getRowVariant={(row) =>
              // 손익 지표는 매출 행에만 있음 — 원가 행은 0이라 그냥 두면 전부 warn으로 칠해짐
              row.category !== '매출' ? ''
                : row.operating_profit < 0 ? 'loss'
                : row.profit_rate < 5 ? 'warn' : ''
            }
            hideableColumns={perfCols.hideable}
            initialColumnVisibility={perfCols.defaultHidden}
            // 프로젝트당 한 줄(백엔드에서 매출+원가 합침) — NO.는 백엔드 _group_no(페이지 넘어가도 연속)
            getRowNumber={(row) => row._group_no}
            // 20자 넘는 셀은 클릭 시 전체 내용 팝업(오버레이)이 먼저 떠서 더블클릭이 td까지 도달하지 못함 —
            // 안내 문구도 실제 동작(짧은 셀만 펼침)에 맞춰 적어 둔다
            hint="숫자 배지 = 재무 보고서 건수 · 프로젝트코드·담당자 더블클릭 → 해당 보고서 확인 가능"
            /* 프로젝트코드 셀이 재무 이력 건수 배지를 그릴 수 있도록 코드↔건수 맵 전달 */
            meta={{ financeCodes: financeCodes.data, rawValues }}
            serverPagination={vm.serverPagination}
            serverSorting={vm.serverSorting}
            serverSearch={vm.serverSearch}
            searchPlaceholder="프로젝트코드·이름·담당자 검색…"
            // 진행단계 — 값 종류가 적고 고정적(제안/착수/완료/드롭 등)이라 검색 필드 옵션 대신
            // 전용 셀렉트로 분리(2026-09-21 요청 — "검색 필드"였을 땐 뭘 입력해야 할지 헷갈림)
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
            // 매출/원가 2행 → 1행으로 바꾸며 기본 컬럼·순서가 달라져 저장된 순서·폭·표시를 새로 시작(2026-10-02)
            storageKey="performance-project-v3"
            // 글씨 많은 컬럼(프로젝트명·사유·중복점검 등) 기본 폭을 넓히면서 저장된 폭 1회 무효화
            sizeVersion={4}   // 4: 프로젝트코드 칸 164 → 230(2026-10-02)
            // 예전 세션에 저장된 컬럼 표시/숨김 값이 그 뒤 추가된 컬럼(월별 컬럼·계획 대비 추정
            // 실적 차이 금액 등)을 계속 기본 숨김 취급하게 만들던 문제 — 저장값 1회 무효화
            visibilityVersion={1}
            expandableRow={{
              getKey: (row) => String(row._row_num),
              excludeColumns: ['filename'],
              renderContent: (row, close) => <FinanceCrossCheckPanel projectCode={row.project_code} onClose={close} />,
              // 검색 결과에 재무 이력이 있는 프로젝트가 있으면 첫 번째 것의 2뎁스를 자동 펼침(2026-09-30)
              autoExpandKey: vm.autoExpandKey,
            }}
          />
      </FadeInSection>

      {/* 2depth: 재무 데이터 검색 결과 */}
      {/* 2depth: 재무 데이터 검색 결과 — 비활성(2026-09-30). 검색하면 표가 하나 더 생겨 "왜 2개지?" 헷갈려서,
          대신 프로젝트 상세 검색 결과 행의 재무 이력(2뎁스)을 자동으로 펼침(expandableRow.autoExpandKey).
          복구 시 usePerformanceViewModel의 FINANCE_SEARCH_SECTION도 true로
      <ErrorBoundary>
        <FinanceSearchResults
          open={vm.hasFinanceResults}
          results={vm.financeResults}
          searchTerm={vm.financeSearchTerm}
          info={INFO_FINANCE_SEARCH}
        />
      </ErrorBoundary>
      */}

      {achieveBreakdown && (
        <PerfBreakdownModal target={achieveBreakdown} onClose={() => setAchieveBreakdown(null)} />
      )}

    </main>
  );
};

export default PerformancePage;
