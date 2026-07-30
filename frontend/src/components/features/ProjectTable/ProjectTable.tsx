import { useProjectTableViewModel } from '@/hooks/viewmodels';
import { DataTable } from '@/components/ui';
import { columns } from './columns.tsx';
import styles from './ProjectTable.module.css';

const HIDEABLE: { id: string; label: string }[] = [
  { id: 'direct_cost', label: '직접원가' },
  { id: 'labor_cost',  label: '인건비'   },
  { id: 'overhead',    label: '공통원가' },
  { id: 'note',        label: '비고'     },
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
      data={vm.data}
      columns={columns}
      getRowId={(row) => `${row.project_code}-${row.stage}`}
      stickyFirstCol
      title="프로젝트 재무 상세"
      isLoading={vm.isLoading}
      isFetching={vm.isFetching}
      searchable
      searchPlaceholder="검색… (Esc: 초기화)"
      hideableColumns={HIDEABLE}
      footer={vm.data.length ? footer : undefined}
      getRowVariant={vm.getRowVariant}
      defaultPageSize={30}
      emptyIcon="🔍"
      emptyTitle="검색 결과 없음"
      emptyDescription="다른 검색어나 필터 조건을 시도해보세요."
    />
  );
};

export default ProjectTable;
