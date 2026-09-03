import { useState } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { usePartTableViewModel } from '@/hooks/viewmodels';
import type { PartTableRow } from '@/hooks/viewmodels/usePartTableViewModel';
import { DataTable } from '@/components/ui';
import styles from './PartTable.module.css';

const SORT_LABEL: Partial<Record<keyof PartTableRow, string>> = {
  revenue:         '매출',
  expenditure:     '지출',
  directCost:      '직접원가',
  laborCost:       '인건비',
  overhead:        '공통원가',
  operatingProfit: '경상이익',
  profitRate:      '이익율',
  count:           '건수',
  part:            '파트',
};

const h = createColumnHelper<PartTableRow>();

// "1.2억원", "16.0%" 등 문자열 → parseFloat으로 숫자 정렬
const numSort = (key: keyof PartTableRow) =>
  (a: { original: PartTableRow }, b: { original: PartTableRow }) =>
    parseFloat(String(a.original[key])) - parseFloat(String(b.original[key]));

const columns = [
  h.accessor('part',            { header: '파트', enableSorting: true }),
  h.accessor('revenue',         { header: '매출',        enableSorting: true, sortingFn: numSort('revenue') }),
  h.accessor('expenditure',     { header: '지출',        enableSorting: true, sortingFn: numSort('expenditure') }),
  h.accessor('directCost',      { header: '직접원가',   enableSorting: true, sortingFn: numSort('directCost') }),
  h.accessor('laborCost',       { header: '인건비',      enableSorting: true, sortingFn: numSort('laborCost') }),
  h.accessor('overhead',        { header: '공통원가',   enableSorting: true, sortingFn: numSort('overhead') }),
  h.accessor('operatingProfit', {
    header: '경상이익',
    enableSorting: true,
    sortingFn: numSort('operatingProfit'),
    cell: i => {
      const row = i.row.original;
      return (
        <span style={{ color: row.isLoss ? 'var(--loss)' : 'var(--profit)', fontWeight: row.isLoss ? 600 : undefined }}>
          {row.operatingProfit}
        </span>
      );
    },
  }),
  h.accessor('profitRate', {
    header: '이익율(%)',
    enableSorting: true,
    sortingFn: numSort('profitRate'),
  }),
  h.accessor('count', { header: '건수', enableSorting: true, cell: i => String(i.getValue()) }),
];

const PartTable = () => {
  const vm = usePartTableViewModel();
  const [sortId, setSortId] = useState<string | null>('revenue');
  const sortLabel = sortId ? (SORT_LABEL[sortId as keyof PartTableRow] ?? null) : null;

  return (
    <div className={styles.sectionGroup}>
      <h3 className={styles.sectionTitle}>
        파트별 실적{sortLabel ? ` (${sortLabel}순)` : ''}
      </h3>
      <div className={styles.section}>
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
          onSortChange={setSortId}
        />
      </div>
    </div>
  );
};

export default PartTable;
