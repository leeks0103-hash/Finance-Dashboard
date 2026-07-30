import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  useReactTable,
  getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, getFilteredRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/Button';
import styles from './DataTable.module.css';

export interface HideableColumn {
  id:    string;
  label: string;
}

interface Props<T> {
  data:               T[];
  columns:            ColumnDef<T, unknown>[];
  getRowId?:          (row: T) => string;
  title?:             string;
  isLoading?:         boolean;
  isFetching?:        boolean;
  getRowVariant?:     (row: T) => 'loss' | 'warn' | '';
  footer?:            Record<string, ReactNode>;
  hideableColumns?:   HideableColumn[];
  defaultPageSize?:   number;
  pageSizeOptions?:   number[];
  searchable?:        boolean;
  searchPlaceholder?: string;
  /** 첫 번째 컬럼을 수평 스크롤 시 고정 */
  stickyFirstCol?:    boolean;
  /** 고정 행 수 테이블 — height auto (페이지네이션 없는 소규모 테이블용) */
  compact?:           boolean;
  /** 툴바 전체 숨김 (행 수 드롭박스, 건수 표시 불필요한 소규모 테이블) */
  hideToolbar?:       boolean;
  emptyIcon?:         string;
  emptyTitle?:        string;
  emptyDescription?:  string;
  /** 검색 디바운스 ms (기본 300) */
  searchDebounceMs?:  number;
}

const DEFAULT_PAGE_SIZES = [10, 20, 30, 50, 100];

const DataTable = <T extends object>({
  data,
  columns,
  getRowId,
  title,
  isLoading         = false,
  isFetching        = false,
  getRowVariant,
  footer,
  hideableColumns,
  defaultPageSize   = 30,
  pageSizeOptions   = DEFAULT_PAGE_SIZES,
  searchable        = false,
  searchPlaceholder = '검색… (Esc: 초기화)',
  stickyFirstCol    = false,
  compact           = false,
  hideToolbar       = false,
  emptyIcon         = '🔍',
  emptyTitle        = '데이터가 없습니다.',
  emptyDescription  = '다른 검색어나 필터 조건을 시도해보세요.',
  searchDebounceMs  = 300,
}: Props<T>) => {
  // 검색 — 입력값과 실제 필터값 분리해 디바운스 적용
  const [searchInput,      setSearchInput]      = useState('');
  const [globalFilter,     setGlobalFilter]     = useState('');
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [showColMenu,      setShowColMenu]      = useState(false);
  const [popupText,        setPopupText]        = useState<string | null>(null);

  const openPopup  = useCallback((text: string) => setPopupText(text), []);
  const closePopup = useCallback(() => setPopupText(null), []);

  // 디바운스: searchInput 변경 후 searchDebounceMs ms 뒤에 실제 필터 적용
  useEffect(() => {
    const timer = setTimeout(() => setGlobalFilter(searchInput), searchDebounceMs);
    return () => clearTimeout(timer);
  }, [searchInput, searchDebounceMs]);

  const table = useReactTable({
    data,
    columns,
    state:  { globalFilter, columnVisibility },
    getRowId,
    onGlobalFilterChange:     setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel:       getCoreRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: defaultPageSize } },
  });

  // Esc 키 — 검색 초기화 또는 팝업 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (popupText) { closePopup(); return; }
        if (searchInput) { setSearchInput(''); setGlobalFilter(''); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchInput, popupText, closePopup]);

  const rows       = table.getRowModel().rows;
  const filtered   = table.getFilteredRowModel().rows;
  const pageIndex  = table.getState().pagination.pageIndex;
  const pageCount  = table.getPageCount();
  const pageSize   = table.getState().pagination.pageSize;

  const pagerNums = useMemo(() => {
    const half = 2, start = Math.max(0, Math.min(pageIndex - half, pageCount - 5));
    return Array.from({ length: Math.min(5, pageCount) }, (_, i) => start + i);
  }, [pageIndex, pageCount]);

  const showPager = pageCount > 1;

  return (
    <div className={`${styles.wrapper} ${compact ? styles.compact : ''}`}>

      {/* 툴바 — hideToolbar=true면 전체 숨김 */}
      {!hideToolbar && (
        <div className={styles.toolbar}>
          {/* ── 왼쪽: title · 건수 · 검색 바 ── */}
          {title && <span className={styles.title}>{title}</span>}

          <span className={styles.count}>
            {globalFilter
              ? `${filtered.length} / ${data.length}건`
              : `${data.length}건`}
          </span>

          {searchable && (
            <div className={styles.searchWrap}>
              <input
                className={styles.search}
                placeholder={searchPlaceholder}
                value={searchInput}
                onChange={e => { setSearchInput(e.target.value); table.setPageIndex(0); }}
              />
              {searchInput && (
                <Button variant="ghost" size="sm" className={styles.searchClear}
                  onClick={() => { setSearchInput(''); setGlobalFilter(''); }} aria-label="초기화">✕</Button>
              )}
            </div>
          )}

          {/* ── 오른쪽: 행 수 · 컬럼 토글 ── */}
          <select
            className={styles.pageSizeSelect}
            value={pageSize}
            onChange={e => { table.setPageSize(Number(e.target.value)); table.setPageIndex(0); }}
          >
            {pageSizeOptions.map(n => <option key={n} value={n}>{n}행</option>)}
          </select>

          {hideableColumns && hideableColumns.length > 0 && (
            <div className={styles.colToggleWrap}>
              <Button variant="ghost" size="sm" onClick={() => setShowColMenu(v => !v)}>
                컬럼 ▾
              </Button>
              {showColMenu && (
                <div className={styles.colMenu}>
                  {hideableColumns.map(({ id, label }) => {
                    const col = table.getColumn(id);
                    return col ? (
                      <label key={id} className={styles.colMenuItem}>
                        <input type="checkbox"
                          checked={col.getIsVisible()}
                          onChange={col.getToggleVisibilityHandler()} />
                        {label}
                      </label>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 테이블 */}
      {isLoading ? (
        <div className={styles.skeletonWrap}>
          {[...Array(6)].map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : (
        <div className={`${styles.scroll} ${isFetching ? styles.fetching : ''}`}>
          <table className={`${styles.table} ${stickyFirstCol ? styles.stickyFirst : ''}`}>
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(h => (
                    <th
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      className={h.column.getCanSort() ? styles.sortable : ''}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getCanSort() && (
                        <span className={h.column.getIsSorted() ? styles.sortActive : styles.sortIdle}>
                          {h.column.getIsSorted() === 'asc'  ? '↑' :
                           h.column.getIsSorted() === 'desc' ? '↓' : '⇅'}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={table.getVisibleLeafColumns().length} className={styles.empty}>
                    <div className={styles.emptyInner}>
                      <span className={styles.emptyIcon}>{emptyIcon}</span>
                      <strong>{emptyTitle}</strong>
                      <span>{emptyDescription}</span>
                    </div>
                  </td>
                </tr>
              ) : rows.map(row => {
                const variant = getRowVariant?.(row.original) ?? '';
                return (
                  <tr key={row.id} className={variant ? styles[variant] : ''}>
                    {row.getVisibleCells().map(cell => {
                      const raw = cell.getValue();
                      const text = raw != null && raw !== '' ? String(raw) : '';
                      const isLong = text.length > 20;
                      return (
                        <td
                          key={cell.id}
                          title={text || undefined}
                          onClick={isLong ? () => openPopup(text) : undefined}
                          className={isLong ? styles.clickable : undefined}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            {footer && rows.length > 0 && (
              <tfoot>
                <tr className={styles.footerRow}>
                  {table.getVisibleLeafColumns().map(col => (
                    <td key={col.id}>{footer[col.id] ?? null}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ── 하단 페이지네이션 바 ── */}
      {showPager && (
        <div className={styles.paginationBar}>
          <span style={{ minWidth: 40 }} />
          <nav className={styles.pagination}>
            <Button variant="ghost" size="sm" className={styles.pgItem}
              onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>이전</Button>
            {pagerNums.map(idx => (
              <Button key={idx}
                variant={idx === pageIndex ? 'primary' : 'ghost'} size="sm"
                className={`${styles.pgItem} ${idx === pageIndex ? styles.pgActive : ''}`}
                onClick={() => table.setPageIndex(idx)}>
                {idx + 1}
              </Button>
            ))}
            <Button variant="ghost" size="sm" className={styles.pgItem}
              onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>다음</Button>
          </nav>
          <span className={styles.pageLabel}>
            {pageIndex + 1} / {pageCount}
          </span>
        </div>
      )}

      {/* 셀 내용 팝업 — Portal로 document.body에 렌더링 (overflow:hidden 회피) */}
      {popupText && createPortal(
        <div className={styles.popupOverlay} onClick={closePopup}>
          <div className={styles.popupBox} onClick={e => e.stopPropagation()}>
            <div className={styles.popupHeader}>
              <span>셀 내용</span>
              <button className={styles.popupClose} onClick={closePopup} aria-label="닫기">✕</button>
            </div>
            <div className={styles.popupBody}>{popupText}</div>
          </div>
        </div>,
        document.body,
      )}

    </div>
  );
};

export default DataTable;
