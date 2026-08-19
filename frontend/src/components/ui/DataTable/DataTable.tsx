import { useState, useEffect, useRef, useMemo, useCallback, type CSSProperties, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  useReactTable,
  getCoreRowModel, getSortedRowModel,
  getPaginationRowModel, getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type Header,
} from '@tanstack/react-table';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { useColumnHighlight } from '@/hooks/useColumnHighlight';
import { useClipboardPopup } from '@/hooks/useClipboardPopup';
import styles from './DataTable.module.css';

// ── 드래그 가능 th — 모듈 스코프에서 정의해야 React가 컴포넌트 정체성 유지 ──
interface DraggableThProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  header:        Header<any, unknown>;
  isDraggable:   boolean;
  isHighlighted: boolean;
  onHeaderClick: (columnId: string) => void;
}
const DraggableTh = ({ header, isDraggable, isHighlighted, onHeaderClick }: DraggableThProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: header.id });
  const toggleSort = header.column.getToggleSortingHandler();
  return (
    <th
      ref={setNodeRef}
      onClick={!isDragging ? (e: ReactMouseEvent<HTMLTableCellElement>) => {
        toggleSort?.(e);
        onHeaderClick(header.column.id);
      } : undefined}
      className={[
        header.column.getCanSort() ? styles.sortable : '',
        header.column.id === '__index' ? styles.indexCell : '',
        isHighlighted ? styles.thHighlighted : '',
      ].join(' ')}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDraggable ? 'grab' : undefined,
        width: header.getSize() !== 150 ? header.getSize() : undefined,
        position: 'relative',
      }}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
      {header.column.getCanSort() && (
        <span className={header.column.getIsSorted() ? styles.sortActive : styles.sortIdle}>
          {header.column.getIsSorted() === 'asc'  ? '↑' :
           header.column.getIsSorted() === 'desc' ? '↓' : '⇅'}
        </span>
      )}
      {isDraggable && header.column.getCanResize() && (
        <div
          onPointerDown={e => { e.stopPropagation(); header.getResizeHandler()(e as never); }}
          onTouchStart={e => { e.stopPropagation(); header.getResizeHandler()(e as never); }}
          onClick={e => e.stopPropagation()}
          className={`${styles.resizeHandle} ${header.column.getIsResizing() ? styles.resizing : ''}`}
        />
      )}
    </th>
  );
};

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
  /** 검색 대상 컬럼 범위 — 3개 모두 제공 시 검색창 옆에 범위 선택 드롭다운 렌더 */
  field?:         string;
  onFieldChange?: (field: string) => void;
  fieldOptions?:  { value: string; label: string }[];
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
  /** 건수 배지 숨김 — 고정 행 수 등 "건수"가 의미 없는 테이블용 */
  hideCount?:         boolean;
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
  /** 초기 컬럼 표시 여부 (기본 숨김 컬럼 지정용) */
  initialColumnVisibility?: Record<string, boolean>;
  /** localStorage 저장 키 — 제공 시 컬럼 순서 DnD + 새로고침 유지 */
  storageKey?: string;
  /** 툴바 우측에 추가 렌더링할 요소 (뷰 전환 토글 등) */
  toolbarExtra?: ReactNode;
  /** 셀 내용 팝업에서 클릭 시 복사 가능하게 할 컬럼 id 목록 (예: 원본파일명) */
  copyableColumns?: string[];
  /** 더블클릭 시 검색바에 해당 셀 값을 자동 입력할 컬럼 id 목록 (예: project_code) */
  searchOnDblClick?: string[];
}

const DEFAULT_PAGE_SIZES = [10, 20, 30, 50, 100];
// 검색·필터로 행이 줄어도 최소 이 정도 높이는 유지 — 결과 1건일 때도 빈 상태처럼 휑해 보이지 않게
const MIN_TABLE_ROWS = 5;

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
  hideCount         = false,
  emptyIcon         = '🔍',
  emptyTitle        = '데이터가 없습니다.',
  emptyDescription  = '다른 검색어나 필터 조건을 시도해보세요.',
  searchDebounceMs  = 300,
  serverPagination,
  serverSearch,
  infiniteLoadMore,
  initialColumnVisibility = {},
  storageKey,
  toolbarExtra,
  copyableColumns,
  searchOnDblClick,
}: Props<T>) => {
  const isServerMode   = !!serverPagination;
  const isInfiniteMode = !!infiniteLoadMore;

  // ── 컬럼 순서 (DnD + localStorage) ────────────────────────────
  const lsKey      = storageKey ? `dnd-cols-${storageKey}`   : null;
  const lsSizeKey  = storageKey ? `col-sizes-${storageKey}`  : null;

  const [colOrder, setColOrder] = useState<string[]>(() => {
    if (!lsKey) return [];
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(lsKey) ?? '[]');
      if (saved.length === 0) return saved;
      // __index가 없거나 첫 번째가 아니면 맨 앞에 강제 삽입
      if (saved[0] === '__index') return saved;
      return ['__index', ...saved.filter(c => c !== '__index')];
    } catch { return []; }
  });

  const [colSizing, setColSizing] = useState<Record<string, number>>(() => {
    if (!lsSizeKey) return {};
    try { return JSON.parse(localStorage.getItem(lsSizeKey) ?? '{}'); } catch { return {}; }
  });

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ── 인덱스 컬럼 (항상 맨 앞, DnD·숨김 제외) ─────────────────
  const indexCol: ColumnDef<T> = useMemo(() => ({
    id: '__index',
    header: 'NO.',
    enableSorting: false,
    enableResizing: false,
    size: 52,
    cell: ({ row, table: t }) => {
      // row.index는 원본 data 배열 기준 고정값이라 정렬 후에는 화면 위치와 어긋남 —
      // 반드시 현재 렌더링(정렬 반영)된 rows에서의 위치를 id로 다시 찾아야 함
      // (indexOf는 참조 동일성에 의존해 getRowModel() 재호출 시 어긋날 수 있어 사용 안 함)
      const posInPage = t.getRowModel().rows.findIndex(r => r.id === row.id);
      const idx = posInPage >= 0 ? posInPage : row.index;
      if (isServerMode) {
        const offset = (serverPagination!.page - 1) * serverPagination!.pageSize;
        return offset + idx + 1;
      }
      const { pageIndex, pageSize } = t.getState().pagination;
      return pageIndex * pageSize + idx + 1;
    },
  }), [isServerMode, serverPagination]);

  const columnsWithIndex = useMemo<ColumnDef<T>[]>(
    () => [indexCol, ...columns],
    [indexCol, columns],
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColOrder(prev => {
      const ids = prev.length ? prev : table.getAllLeafColumns().map(c => c.id);
      const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
      // __index는 항상 첫 번째 고정
      const fixed = ['__index', ...next.filter(c => c !== '__index')];
      if (lsKey) localStorage.setItem(lsKey, JSON.stringify(fixed));
      return fixed;
    });
  }, [lsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // 클라이언트 검색 상태 (서버모드에선 사용 안 함)
  const [searchInput,      setSearchInput]      = useState('');
  const [globalFilter,     setGlobalFilter]     = useState('');
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(initialColumnVisibility);
  const [showColMenu,      setShowColMenu]      = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  const tableWrapRef = useRef<HTMLDivElement>(null);
  const { highlightedCol, setHighlight, clearHighlight } = useColumnHighlight();
  const { popup, copied: popupCopied, openPopup: openPopupRaw, closePopup, copyPopupText } = useClipboardPopup();

  const openPopup = useCallback((text: string, columnId?: string) => {
    openPopupRaw(text, !!columnId && !!copyableColumns?.includes(columnId));
  }, [copyableColumns, openPopupRaw]);

  useEffect(() => {
    if (isServerMode) return;
    const timer = setTimeout(() => setGlobalFilter(searchInput.trim()), searchDebounceMs);
    return () => clearTimeout(timer);
  }, [searchInput, searchDebounceMs, isServerMode]);

  const searchQuery = isServerMode ? (serverSearch?.value ?? '') : globalFilter;

  const table = useReactTable({
    data,
    columns: columnsWithIndex,
    meta: { searchQuery },
    state: {
      globalFilter: isServerMode ? undefined : globalFilter,
      columnVisibility,
      columnSizing: colSizing,
      ...(storageKey && colOrder.length ? { columnOrder: colOrder } : {}),
    },
    columnResizeMode: storageKey ? 'onChange' : undefined,
    getRowId,
    onGlobalFilterChange:     isServerMode ? undefined : setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: storageKey ? (updater) => {
      setColSizing(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (lsSizeKey) localStorage.setItem(lsSizeKey, JSON.stringify(next));
        return next;
      });
    } : undefined,
    onColumnOrderChange: storageKey ? (updater) => {
      setColOrder(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (lsKey) localStorage.setItem(lsKey, JSON.stringify(next));
        return next;
      });
    } : undefined,
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

  // 컬럼 드롭박스 외부 클릭 시 닫기
  useEffect(() => {
    if (!showColMenu) return;
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setShowColMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColMenu]);

  // data가 줄어들어 현재 페이지가 범위를 벗어나면 page 0으로 리셋
  useEffect(() => {
    if (isServerMode) return;
    const state = table.getState().pagination;
    const count = table.getPageCount();
    if (count > 0 && state.pageIndex >= count) {
      table.setPageIndex(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (popup) { closePopup(); return; }
        if (highlightedCol) { clearHighlight(); return; }
        if (isServerMode) {
          serverSearch?.onChange('');
        } else {
          setSearchInput(''); setGlobalFilter('');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchInput, popup, closePopup, isServerMode, serverSearch, highlightedCol, clearHighlight]);

  // 테이블 외부 클릭 시 하이라이트 해제
  useEffect(() => {
    if (!highlightedCol) return;
    const onMouseDown = (e: MouseEvent) => {
      if (tableWrapRef.current && !tableWrapRef.current.contains(e.target as Node)) {
        clearHighlight();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [highlightedCol, clearHighlight]);

  const rows     = table.getRowModel().rows;
  const filtered = isServerMode ? null : table.getFilteredRowModel().rows;

  // 페이지 상태 — 서버/클라이언트 통합
  const pageIndex   = isServerMode ? serverPagination!.page - 1 : table.getState().pagination.pageIndex;
  const pageSize    = isServerMode ? serverPagination!.pageSize : table.getState().pagination.pageSize;
  // 실제 보여지는 행 수 기준 — pageSize를 다 못 채워도(검색 결과 적음) 그만큼만 여백 확보
  const dtRows      = Math.max(MIN_TABLE_ROWS, Math.min(pageSize, rows.length));
  const pageCount   = isServerMode
    ? Math.ceil(serverPagination!.total / serverPagination!.pageSize)
    : table.getPageCount();

  const goToPage = useCallback((idx: number) => {
    if (isServerMode) serverPagination!.onPageChange(idx + 1);
    else table.setPageIndex(idx);
  }, [isServerMode, serverPagination, table]);

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
  const hasToolbarContent = pageSizeOptions.length > 1 ||
    (hideableColumns && hideableColumns.length > 0) ||
    showSearch;

  const tableCard = (
    <div
      ref={tableWrapRef}
      className={`${styles.wrapper} ${compact ? styles.compact : ''}`}
      style={{ '--dt-rows': dtRows } as CSSProperties}
    >

      {!hideToolbar && hasToolbarContent && (
        <div className={styles.toolbar}>
          {/* 왼쪽: 행 수 조절 + 컬럼 토글 */}
          <div className={styles.toolbarLeft}>
            {pageSizeOptions.length > 1 && (
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
            )}

            {hideableColumns && hideableColumns.length > 0 && (
              <div className={styles.colToggleWrap} ref={colMenuRef}>
                <Button variant="ghost" size="sm" onClick={() => setShowColMenu(v => !v)}>
                  컬럼 ▾
                </Button>
                {showColMenu && (
                  <div className={`${styles.colMenu}${hideableColumns.length > 12 ? ` ${styles.colMenuGrid}` : ''}`}>
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

          {/* 오른쪽: 검색 + 툴바 추가 요소 */}
          {showSearch && (
            <div className={styles.searchWrap}>
              {serverSearch?.fieldOptions && (
                <select
                  className={styles.searchFieldSelect}
                  value={serverSearch.field ?? ''}
                  onChange={e => serverSearch.onFieldChange?.(e.target.value)}
                  aria-label="검색 범위"
                >
                  {serverSearch.fieldOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
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
          {/* DndContext를 table 바깥으로 — thead 안에 div 자식이 생기는 HTML 오류 방지 */}
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
          <table className={`${styles.table} ${stickyFirstCol ? styles.stickyFirst : ''}`}>
            <thead>
              {table.getHeaderGroups().map(hg => (
                  <SortableContext
                    key={hg.id}
                    items={hg.headers.filter(h => h.id !== '__index').map(h => h.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    <tr>
                      {hg.headers.map(h => (
                        <DraggableTh
                          key={h.id}
                          header={h}
                          isDraggable={!!storageKey && h.id !== '__index'}
                          isHighlighted={highlightedCol === h.column.id}
                          onHeaderClick={setHighlight}
                        />
                      ))}
                    </tr>
                  </SortableContext>
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
                          onClick={isLong ? () => openPopup(text, cell.column.id) : undefined}
                          onDoubleClick={searchOnDblClick?.includes(cell.column.id) && text
                            ? () => {
                                if (isServerMode) serverSearch?.onChange(text);
                                else { setSearchInput(text); setGlobalFilter(text); }
                              }
                            : undefined}
                          className={[
                            isLong ? styles.clickable : '',
                            searchOnDblClick?.includes(cell.column.id) ? styles.dblClickable : '',
                            cell.column.id === '__index' ? styles.indexCell : '',
                            highlightedCol === cell.column.id ? styles.tdHighlighted : '',
                          ].join(' ') || undefined}
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
          </DndContext>
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
      {!isInfiniteMode && (
        <Pagination
          page={pageIndex + 1}
          pageCount={pageCount}
          onPageChange={p => goToPage(p - 1)}
        />
      )}

      {popup && createPortal(
        <div className={styles.popupOverlay} onClick={closePopup}>
          <div className={styles.popupBox} onClick={e => e.stopPropagation()}>
            <div className={styles.popupHeader}>
              <span>셀 내용</span>
              <Button variant="ghost" size="sm" className={styles.popupClose} onClick={closePopup} aria-label="닫기">✕</Button>
            </div>
            {popup.copyable ? (
              <div
                className={`${styles.popupBody} ${styles.popupBodyCopyable} ${popupCopied ? styles.popupBodyCopied : ''}`}
                onClick={copyPopupText}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && copyPopupText()}
              >
                <span>{popup.text}</span>
                <span className={styles.popupCopyHint}>{popupCopied ? '✓ 복사됨' : '클릭해서 복사'}</span>
              </div>
            ) : (
              <div className={styles.popupBody}>{popup.text}</div>
            )}
          </div>
        </div>,
        document.body,
      )}

    </div>
  );

  if (!title) return tableCard;

  return (
    <div className={styles.outerGroup}>
      <div className={styles.outerTitle}>
        <div className={styles.outerTitleLeft}>
          <span className={styles.title}>{title}</span>
          {!hideCount && <span className={styles.count}>{countLabel}</span>}
        </div>
        {toolbarExtra && <div>{toolbarExtra}</div>}
      </div>
      {tableCard}
    </div>
  );
};

export default DataTable;
