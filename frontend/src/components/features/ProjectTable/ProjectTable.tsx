import { useEffect, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';
import { useProjectTableViewModel } from '@/hooks/viewmodels';
import { EmptyState, Button } from '@/components/ui';
import { columns } from './columns.tsx';
import styles from './ProjectTable.module.css';

const HIDE_LABELS: Record<string, string> = {
  direct_cost: '직접원가',
  labor_cost:  '인건비',
  overhead:    '공통원가',
  note:        '비고',
};

const ProjectTable = () => {
  const vm = useProjectTableViewModel();
  const [colVisibility, setColVisibility] = useState<Record<string, boolean>>({});
  const [showColMenu, setShowColMenu] = useState(false);

  const table = useReactTable({
    data: vm.data,
    columns,
    state: { sorting: vm.sorting, globalFilter: vm.globalFilter, columnVisibility: colVisibility },
    onSortingChange:          vm.onSortingChange,
    onGlobalFilterChange:     vm.onFilterChange,
    onColumnVisibilityChange: setColVisibility,
    getCoreRowModel:       getCoreRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 30 } },
  });

  const rows      = table.getRowModel().rows;
  const pageLabel = vm.getPageLabel(
    table.getState().pagination.pageIndex,
    table.getPageCount()
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') vm.clearSearch();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [vm.clearSearch]);

  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.count}>
          프로젝트 재무 상세
          <span className={styles.badge}>
            {vm.busy ? '…' : vm.globalFilter ? `${filteredCount} / ${vm.data.length}` : vm.data.length}
          </span>
        </div>
        <div className={styles.headerRight}>
          {/* 컬럼 가시성 토글 */}
          <div className={styles.colToggle}>
            <Button variant="ghost" size="sm" onClick={() => setShowColMenu(v => !v)}>
              컬럼 ▾
            </Button>
            {showColMenu && (
              <div className={styles.colMenu}>
                {table.getAllLeafColumns()
                  .filter(col => col.id in HIDE_LABELS)
                  .map(col => (
                    <label key={col.id} className={styles.colMenuItem}>
                      <input
                        type="checkbox"
                        checked={col.getIsVisible()}
                        onChange={col.getToggleVisibilityHandler()}
                      />
                      {HIDE_LABELS[col.id]}
                    </label>
                  ))}
              </div>
            )}
          </div>
          <div className={styles.searchWrap}>
            <input
              className={styles.search}
              placeholder="검색… (Esc: 초기화)"
              value={vm.inputValue}
              onChange={vm.handleSearch}
              disabled={vm.busy}
            />
            {vm.inputValue && (
              <Button variant="ghost" size="sm" className={styles.searchClear} onClick={vm.clearSearch} aria-label="검색 초기화">
                ✕
              </Button>
            )}
          </div>
        </div>
      </div>

      {vm.isLoading ? (
        <div className={styles.loadingRows}>
          {[...Array(5)].map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="검색 결과 없음"
          description="다른 검색어나 필터 조건을 시도해 보세요."
          action={vm.inputValue
            ? <Button variant="ghost" size="sm" onClick={vm.clearSearch}>검색어 초기화</Button>
            : undefined
          }
        />
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
                        className={[
                          header.column.getCanSort() ? styles.sortable : '',
                          header.id === 'project_code' ? styles.stickyCol : '',
                        ].join(' ')}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span style={{ marginLeft: 4, opacity: header.column.getIsSorted() ? 1 : 0.35, fontSize: '0.7rem' }}>
                            {header.column.getIsSorted() === 'asc'  ? '▲' :
                             header.column.getIsSorted() === 'desc' ? '▼' : '⇅'}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {rows.map(row => {
                  const variant = vm.getRowVariant(row.original);
                  return (
                    <tr key={row.id} className={variant ? styles[variant] : ''}>
                      {row.getVisibleCells().map(cell => (
                        <td
                          key={cell.id}
                          className={cell.column.id === 'project_code' ? styles.stickyCol : ''}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className={styles.summaryRow}>
                  <td className={`${styles.stickyCol} ${styles.summaryLabel}`}>합계</td>
                  <td /><td /><td />
                  <td>{vm.summary.revenue}</td>
                  <td>{vm.summary.expenditure}</td>
                  <td>{vm.summary.directCost}</td>
                  <td>{vm.summary.laborCost}</td>
                  <td>{vm.summary.overhead}</td>
                  <td className={Number(vm.summary.operatingProfit?.replace(/[^0-9.-]/g, '')) < 0 ? styles.lossText : ''}>
                    {vm.summary.operatingProfit}
                  </td>
                  <td>{vm.summary.avgProfitRate}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className={styles.paginationBar}>
            {/* 좌측: 빈 공간 균형용 */}
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: 40 }}>
              {pageLabel}
            </span>

            {/* 중앙: 페이지네이션 + 행 수 드롭박스 나란히 */}
            <nav className={styles.pagination} aria-label="페이지 이동">
              <Button variant="ghost" size="sm" className={styles.pgItem}
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}>이전</Button>
              {vm.getPageNumbers(table.getState().pagination.pageIndex, table.getPageCount()).map(pageIdx => (
                <Button key={pageIdx} variant={pageIdx === table.getState().pagination.pageIndex ? 'primary' : 'ghost'}
                  size="sm"
                  className={`${styles.pgItem} ${pageIdx === table.getState().pagination.pageIndex ? styles.pgActive : ''}`}
                  onClick={() => table.setPageIndex(pageIdx)}>
                  {pageIdx + 1}
                </Button>
              ))}
              <Button variant="ghost" size="sm" className={styles.pgItem}
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}>다음</Button>

              {/* 구분선 + 행 수 드롭박스 */}
              <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 6px', display: 'inline-block', verticalAlign: 'middle' }} />
              <select
                className={styles.pageSize}
                value={table.getState().pagination.pageSize}
                onChange={e => table.setPageSize(Number(e.target.value))}
              >
                {[10, 30, 50, 100].map(s => <option key={s} value={s}>{s}행</option>)}
              </select>
            </nav>

            {/* 우측: 균형용 빈 공간 */}
            <span style={{ minWidth: 40 }} />
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectTable;
