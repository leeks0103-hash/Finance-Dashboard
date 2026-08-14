import { createColumnHelper } from '@tanstack/react-table';
import { usePartTableViewModel } from '@/hooks/viewmodels';
import type { PartTableRow } from '@/hooks/viewmodels/usePartTableViewModel';
import { DataTable } from '@/components/ui';
import styles from './PartTable.module.css';

const h = createColumnHelper<PartTableRow>();

const columns = [
  h.accessor('part',            { header: '파트', enableSorting: true }),
  h.accessor('revenue',         { header: '매출',     enableSorting: true }),
  h.accessor('expenditure',     { header: '지출' }),
  h.accessor('directCost',      { header: '직접원가' }),
  h.accessor('laborCost',       { header: '인건비' }),
  h.accessor('overhead',        { header: '공통원가' }),
  h.accessor('operatingProfit', {
    header: '경상이익',
    cell: i => {
      const row = i.row.original;
      return (
        <span style={{ color: row.isLoss ? 'var(--loss)' : 'var(--profit)', fontWeight: row.isLoss ? 600 : undefined }}>
          {row.operatingProfit}
        </span>
      );
    },
  }),
  h.accessor('profitRate',  { header: '이익율(%)', enableSorting: true }),
  h.accessor('count',       { header: '건수', cell: i => String(i.getValue()) }),
];

const PartTable = () => {
  const vm = usePartTableViewModel();

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>파트별 실적</h3>
      <DataTable<PartTableRow>
        data={vm.rows}
        columns={columns as never}
        getRowId={row => row.part}
        getRowVariant={row => row.isLoss ? 'loss' : ''}
        isLoading={vm.isLoading}
        defaultPageSize={10}
        pageSizeOptions={[10]}
        compact
        hideToolbar
      />
    </div>
  );
};

export default PartTable;
