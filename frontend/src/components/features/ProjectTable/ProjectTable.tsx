import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import { useProjectTableViewModel } from '@/hooks/viewmodels';
import { EmptyState, Button } from '@/components/ui';
import { columns } from './columns.tsx';
import styles from './ProjectTable.module.css';

const ProjectTable = () => {
  const vm = useProjectTableViewModel();

  const table = useReactTable({
    data: vm.data,
    columns,
    state: { sorting: vm.sorting, globalFilter: vm.globalFilter },
    onSortingChange:      vm.onSortingChange,
    onGlobalFilterChange: vm.onFilterChange,
    getCoreRowModel:       getCoreRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 30 } },
  });

  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();
  const pageLabel = pageCount > 0
    ? `${table.getState().pagination.pageIndex + 1} / ${pageCount}`
    : '0 / 0';

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.count}>
          프로젝트 재무 상세
          <span className={styles.badge}>{vm.busy ? '…' : vm.data.length}</span>
        </div>
        <input
          className={styles.search}
          placeholder="검색…"
          value={vm.inputValue}
          onChange={vm.handleSearch}
          disabled={vm.busy}
        />
      </div>

      {vm.isLoading ? (
        <div className={styles.loadingRows}>
          {[...Array(5)].map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon="🔍" title="검색 결과 없음" description="다른 검색어나 필터 조건을 시도해 보세요." />
      ) : (
        <>
          <div className={`${styles.tableWrap} ${vm.isFetching ? styles.fetching : ''}`}>
            <table className={styles.table}>
              <thead>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id}>
                    {hg.headers.map(header => (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className={header.column.getCanSort() ? styles.sortable : ''}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc'  ? ' ↑' :
                         header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            <Button variant="ghost" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>이전</Button>
            <span>{pageLabel}</span>
            <Button variant="ghost" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>다음</Button>
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectTable;
