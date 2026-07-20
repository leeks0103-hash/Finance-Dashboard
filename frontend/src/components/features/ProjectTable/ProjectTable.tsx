import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, getFilteredRowModel,
  flexRender, type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { useProjects } from '../../../hooks/useProjects';
import { columns } from './columns';
import styles from './ProjectTable.module.css';

const ProjectTable = () => {
  const { data = [], isLoading } = useProjects();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 30 } },
  });

  if (isLoading) return <div className={styles.loading}>로딩 중…</div>;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.count}>프로젝트 재무 상세 <span className={styles.badge}>{data.length}</span></div>
        <input
          className={styles.search}
          placeholder="검색…"
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
        />
      </div>

      <div className={styles.tableWrap}>
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
            {table.getRowModel().rows.map(row => (
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
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>이전</button>
        <span>{table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>다음</button>
      </div>
    </div>
  );
};

export default ProjectTable;
