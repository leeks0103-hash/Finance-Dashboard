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

/** 서버사이드 페이지네이션 — ViewModel이 상태 관리, DataTable은 표시·이벤트만 */
export interface ServerPagination {
  total:            number;
  page:             number;
  pageSize:         number;
  onPageChange:     (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/** 서버사이드 검색 — 디바운스는 ViewModel에서 처리 */
export interface ServerSearch {
  value:    string;
  onChange: (value: string) => void;
}

/** 무한 로드 모드 (useInfiniteQuery 연동) */
export interface InfiniteLoadMore {
  total:              number;
  hasNextPage:        boolean;
  isFetchingNextPage: boolean;
  fetchNextPage:      () => void;
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
  stickyFirstCol?:    boolean;
  compact?:           boolean;
  hideToolbar?:       boolean;
  emptyIcon?:         string;
  emptyTitle?:        string;
  emptyDescription?:  string;
  searchDebounceMs?:  number;
  /** 서버사이드 페이지네이션 — 제공 시 클라이언트 페이지네이션 비활성화 */
  serverPagination?:  ServerPagination;
  /** 서버사이드 검색 — 제공 시 내부 검색 상태 비활성화 */
  serverSearch?:      ServerSearch;
  /** 무한 로드 모드 — serverPagination 대신 사용 (useInfiniteQuery 연동) */
  infiniteLoadMore?:  InfiniteLoadMore;
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
  serverPagination,
  serverSearch,
  infiniteLoadMore,
}: Props<T>) => {
  const isServerMode   = !!serverPagination;
  const isInfiniteMode = !!infiniteLoadMore;

  // 클라이언트 검색 상태 (서버모드에선 사용 안 함)
  const [searchInput,      setSearchInput]      = useState('');
  const [globalFilter,     setGlobalFilter]     = useState('');
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [showColMenu,      setShowColMenu]      = useState(false);
  const [popupText,        setPopupText]        = useState<string | null>(null);

  const openPopup  = useCallback((text: string) => setPopupText(text), []);
  const closePopup = useCallback(() => setPopupText(null), []);

  useEffect(() => {
    if (isServerMode) return;
    const timer = setTimeout(() => setGlobalFilter(searchInput), searchDebounceMs);
    return () => clearTimeout(timer);
  }, [searchInput, searchDebounceMs, isServerMode]);

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter: isServerMode ? undefined : globalFilter,
      columnVisibility,
    },
    getRowId,
    onGlobalFilterChange:     isServerMode ? undefined : setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel:       getCoreRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    // 서버모드: 필터·페이지네이션 모델 제거 (서버가 처리)
    ...(!isServerMode && {
      getFilteredRowModel:   getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      initialState: { pagination: { pageSize: defaultPageSize } },
    }),
    ...(isServerMode && {
      manualPagination: true,
      rowCount: serverPagination!.total,
    }),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (popupText) { closePopup(); return; }
        if (isServerMode) {
          serverSearch?.onChange('');
        } else if (searchInput) {
          setSearchInput(''); setGlobalFilter('');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchInput, popupText, closePopup, isServerMode, serverSearch]);

  const rows     = table.getRowModel().rows;
  const filtered = isServerMode ? null : table.getFilteredRowModel().rows;

  // 페이지 상태 — 서버/클라이언트 통합
  const pageIndex   = isServerMode ? serverPagination!.page - 1 : table.getState().pagination.pageIndex;
  const pageSize    = isServerMode ? serverPagination!.pageSize : table.getState().pagination.pageSize;
  const pageCount   = isServerMode
    ? Math.ceil(serverPagination!.total / serverPagination!.pageSize)
    : table.getPageCount();

  const goToPage = useCallback((idx: number) => {
    if (isServerMode) serverPagination!.onPageChange(idx + 1);
    else table.setPageIndex(idx);
  }, [isServerMode, serverPagination, table]);

  const canPrev = isServerMode ? serverPagination!.page > 1 : table.getCanPreviousPage();
  const canNext = isServerMode ? serverPagination!.page < pageCount : table.getCanNextPage();

  const pagerNums = useMemo(() => {
    const half = 2, start = Math.max(0, Math.min(pageIndex - half, pageCount - 5));
    return Array.from({ length: Math.min(5, pageCount) }, (_, i) => start + i);
  }, [pageIndex, pageCount]);

  const showPager = pageCount > 1;

  // 건수 표시
  const countLabel = useMemo(() => {
    if (isServerMode)   return `${serverPagination!.total}건`;
    if (isInfiniteMode) return `${rows.length} / ${infiniteLoadMore!.total}건`;
    const search = globalFilter;
    if (search && filtered) return `${filtered.length} / ${data.length}건`;
    return `${data.length}건`;
  }, [isServerMode, isInfiniteMode, serverPagination, infiniteLoadMore, globalFilter, filtered, data.length, rows.length]);

  // 검색 값·핸들러
  const searchValue    = isServerMode ? (serverSearch?.value ?? '') : searchInput;
  const hasSearchValue = searchValue.length > 0;

  const handleSearchChange = useCallback((val: string) => {
    if (isServerMode) {
      serverSearch?.onChange(val);
    } else {
      setSearchInput(val);
      table.setPageIndex(0);
    }
  }, [isServerMode, serverSearch, table]);

  const clearSearch = useCallback(() => {
    if (isServerMode) serverSearch?.onChange('');
    else { setSearchInput(''); setGlobalFilter(''); }
  }, [isServerMode, serverSearch]);

  const showSearch = searchable || !!serverSearch;

  return (
    <div className={`${styles.wrapper} ${compact ? styles.compact : ''}`}>

      {!hideToolbar && (
        <div className={styles.toolbar}>
          {title && <span className={styles.title}>{title}</span>}
          <span className={styles.count}>{countLabel}</span>

          <select
            className={styles.pageSizeSelect}
            value={pageSize}
            onChange={e => {
              const n = Number(e.target.value);
              if (isServerMode) serverPagination!.onPageSizeChange(n);
              else { table.setPageSize(n); table.setPageIndex(0); }
            }}
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

          {showSearch && (
            <div className={styles.searchWrap}>
              <input
                className={styles.search}
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={e => handleSearchChange(e.target.value)}
              />
              {hasSearchValue && (
                <Button variant="ghost" size="sm" className={styles.searchClear}
                  onClick={clearSearch} aria-label="초기화">✕</Button>
              )}
            </div>
          )}
        </div>
      )}

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

      {/* 무한 로드 모드 — "더 보기" 버튼 */}
      {isInfiniteMode && infiniteLoadMore!.hasNextPage && (
        <div className={styles.paginationBar}>
          <Button
            variant="ghost"
            size="sm"
            className={styles.pgItem}
            onClick={infiniteLoadMore!.fetchNextPage}
            loading={infiniteLoadMore!.isFetchingNextPage}
          >
            더 보기
          </Button>
        </div>
      )}

      {/* 일반 / 서버 페이지 네비게이션 */}
      {!isInfiniteMode && showPager && (
        <div className={styles.paginationBar}>
          <span style={{ minWidth: 40 }} />
          <nav className={styles.pagination}>
            <Button variant="ghost" size="sm" className={styles.pgItem}
              onClick={() => goToPage(pageIndex - 1)} disabled={!canPrev}>이전</Button>
            {pagerNums.map(idx => (
              <Button key={idx}
                variant={idx === pageIndex ? 'primary' : 'ghost'} size="sm"
                className={`${styles.pgItem} ${idx === pageIndex ? styles.pgActive : ''}`}
                onClick={() => goToPage(idx)}>
                {idx + 1}
              </Button>
            ))}
            <Button variant="ghost" size="sm" className={styles.pgItem}
              onClick={() => goToPage(pageIndex + 1)} disabled={!canNext}>다음</Button>
          </nav>
          <span className={styles.pageLabel}>
            {pageIndex + 1} / {pageCount}
          </span>
        </div>
      )}

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
