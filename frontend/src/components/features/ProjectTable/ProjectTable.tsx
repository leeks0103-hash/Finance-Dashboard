import { useProjectTableViewModel } from '@/hooks/viewmodels';
import { DataTable } from '@/components/ui';
import { columns } from './columns.tsx';
import styles from './ProjectTable.module.css';

const HIDEABLE: { id: string; label: string }[] = [
  { id: 'direct_cost', label: '직접원가' },
  { id: 'labor_cost',  label: '인건비'   },
  { id: 'overhead',    label: '공통원가' },
  { id: 'note',        label: '비고'     },
  { id: 'filename',    label: '원본파일명' },
];

const ProjectTable = () => {
  const vm = useProjectTableViewModel();

  const footer = {
    project_code:     <span className={styles.summaryLabel}>합계</span>,
    revenue:          vm.summary.revenue,
    expenditure:      vm.summary.expenditure,
    direct_cost:      vm.summary.directCost,
    labor_cost:       vm.summary.laborCost,
    overhead:         vm.summary.overhead,
    operating_profit: (
      <span style={{
        color: (vm.summary.operatingProfit ?? '').startsWith('-')
          ? 'var(--loss)' : undefined,
      }}>
        {vm.summary.operatingProfit}
      </span>
    ),
    profit_rate: vm.summary.avgProfitRate,
  };

  return (
    <DataTable
      data={vm.rows}
      columns={columns}
      getRowId={(row) => String(row._row_num)}
      stickyFirstCol
      title="프로젝트 재무 상세"
      isLoading={vm.isLoading}
      isFetching={vm.isFetching}
      hideableColumns={HIDEABLE}
      // footer={vm.rows.length ? footer : undefined}  // 서버사이드 페이지네이션으로 전체 합계와 불일치 — 상단 KPI 카드로 대체
      getRowVariant={vm.getRowVariant}
      serverPagination={vm.serverPagination}
      serverSearch={vm.serverSearch}
      emptyIcon="🔍"
      emptyTitle="검색 결과 없음"
      emptyDescription="다른 검색어나 필터 조건을 시도해보세요."
      initialColumnVisibility={{ filename: true }}
      storageKey="finance-project"
    />
  );
};

export default ProjectTable;
