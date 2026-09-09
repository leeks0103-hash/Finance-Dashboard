import { useState, useRef, useMemo, useCallback, useEffect, Fragment, type CSSProperties, type ReactNode } from 'react';
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
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { useColumnHighlight } from './useColumnHighlight';
import { useClipboardPopup } from './useClipboardPopup';
import { useTableEscapePriority } from './useTableEscapePriority';
import { useTableDndSensors } from './useTableDndSensors';
import { SortableHeaderCell } from './SortableHeaderCell';
import { CellPopup } from './CellPopup';
import { TableTitleBar } from './TableTitleBar';
import styles from './DataTable.module.css';

// 정렬 상태 → 화살표 문자 (중첩 삼항 대신 순차 조건으로 — 어떤 상태가 어떤 기호인지 한눈에 보이게)
function sortArrow(sorted: false | 'asc' | 'desc'): string {
  if (sorted === 'asc')  return '↑';
  if (sorted === 'desc') return '↓';
  return '↕';
}

// ── 드래그 가능 th — 모듈 스코프에서 정의해야 React가 컴포넌트 정체성 유지 ──
interface DraggableThProps<T> {
  header:        Header<T, unknown>;
  isDraggable:   boolean;
  isHighlighted: boolean;
  isFirst:       boolean;
  onHeaderClick: (columnId: string) => void;
}
function DraggableTh<T>({ header, isDraggable, isHighlighted, isFirst, onHeaderClick }: DraggableThProps<T>) {
  const toggleSort = header.column.getToggleSortingHandler();
  return (
    <SortableHeaderCell
      id={header.id}
      isDraggable={isDraggable}
      isHighlighted={isHighlighted}
      highlightedClassName={styles.thHighlighted}
      className={[
        isFirst ? styles.firstCol : '',
        header.column.getCanSort() ? styles.sortable : '',
        header.column.id === '__index' ? styles.indexCell : '',
        header.column.columnDef.meta?.staticCol ? styles.staticCol : '',
      ].join(' ')}
      width={header.getSize()}
      onClick={e => { toggleSort?.(e); onHeaderClick(header.column.id); }}
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
      {header.column.getCanSort() && (
        <span className={header.column.getIsSorted() ? styles.sortActive : styles.sortIdle}>
          {sortArrow(header.column.getIsSorted())}
        </span>
      )}
      {isDraggable && header.column.getCanResize() && (
        <div
          onPointerDown={e => { e.stopPropagation(); header.getResizeHandler()(e as never); }}
          onTouchStart={e => { e.stopPropagation(); header.getResizeHandler()(e as never); }}
          onClick={e => e.stopPropagation()}
          onDoubleClick={e => {
            e.stopPropagation();
            const thEl    = (e.currentTarget as HTMLElement).closest('th');
            const tableEl = thEl?.closest('table') as HTMLTableElement | null;
            if (!tableEl || !thEl) return;
            const colId    = header.column.id;
            const tanTable = header.getContext().table;

            // 실제 셀의 computed font으로 임시 span 측정 — canvas보다 정확
            const span = document.createElement('span');
            span.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:-9999px';
            document.body.appendChild(span);

            const thFont = getComputedStyle(thEl).font;
            const firstTd = tableEl.querySelector('tbody td') as HTMLElement | null;
            const tdFont  = firstTd ? getComputedStyle(firstTd).font : thFont;

            // 헤더 텍스트 너비
            span.style.font  = thFont;
            span.textContent = String(header.column.columnDef.header ?? '');
            let maxW = span.offsetWidth + 32; // 패딩 + 정렬 화살표 + 리사이즈 핸들 여유

            // 모든 행의 셀 값 너비
            span.style.font = tdFont;
            tanTable.getRowModel().rows.forEach(row => {
              const cell = row.getAllCells().find(c => c.column.id === colId);
              const val  = String(cell?.getValue() ?? '');
              span.textContent = val;
              maxW = Math.max(maxW, span.offsetWidth + 20); // 좌우 패딩
            });

            document.body.removeChild(span);
            tanTable.setColumnSizing(prev => ({ ...prev, [colId]: Math.min(Math.max(maxW, 60), 400) }));
          }}
          className={`${styles.resizeHandle} ${header.column.getIsResizing() ? styles.resizing : ''}`}
        />
      )}
    </SortableHeaderCell>
  );
}

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

/** 더블클릭한 행 바로 아래에 콘텐츠를 펼쳐 보여주는 기능 — 한 번에 하나만 열림(toggle) */
export interface ExpandableRow<T> {
  getKey:          (row: T) => string;
  /** 이 컬럼 id들은 더블클릭해도 확장 안 됨 (예: 파일명 — 기존 팝업 복사 기능 유지) */
  excludeColumns?: string[];
  renderContent:   (row: T, close: () => void) => ReactNode;
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
  /**
   * 컬럼 기본 너비를 바꿨을 때 올리는 값 — 저장된 폭만 무효화한다(컬럼 순서는 유지).
   * 안 올리면 이미 저장된 localStorage 폭이 이겨서 새 기본값이 화면에 반영되지 않음.
   */
  sizeVersion?: string | number;
  /** 툴바 우측에 추가 렌더링할 요소 (뷰 전환 토글 등) */
  toolbarExtra?: ReactNode;
  /** 제목 옆 ⓘ 버튼 — 클릭 시 데이터 기준 설명 팝오버 */
  info?: ReactNode;
  /** 더블클릭 시 검색바에 해당 셀 값을 자동 입력할 컬럼 id 목록 (예: project_code) */
  searchOnDblClick?: string[];
  /** 더블클릭 시 행 바로 아래에 콘텐츠를 펼치는 기능 — searchOnDblClick과 동시 사용 시 이쪽이 우선 */
  expandableRow?: ExpandableRow<T>;
  /** 연속된 행을 이 키로 묶어, 그룹 안에서 값이 같은 컬럼은 세로 병합(rowSpan)
   *  (예: 매출/원가 2행짜리 프로젝트 → 프로젝트코드·이름 등은 한 칸으로) */
  mergeRowsByKey?: (row: T) => string | number;
  /** NO. 컬럼 값을 직접 지정 — 서버가 내려준 묶음 일련번호처럼 페이지를 넘어 연속돼야 할 때 사용
   *  (미지정 시 화면상 행 위치로 자동 계산) */
  getRowNumber?: (row: T) => number | string;
  /** 툴바에 흐린 글씨로 띄우는 사용법 안내 (예: "코드 더블클릭 시 재무 데이터") */
  hint?: ReactNode;
  /** 정렬 컬럼 변경 시 콜백 — columnId(정렬중) 또는 null(정렬 해제) */
  onSortChange?: (columnId: string | null) => void;
  /** ColumnMeta.staticCol 음영 강도 — 'soft'는 절반 알파 (기본 음영이 진하다는 피드백 있는 테이블용) */
  staticColShade?: 'default' | 'soft';
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
  sizeVersion,
  toolbarExtra,
  info,
  searchOnDblClick,
  expandableRow,
  mergeRowsByKey,
  getRowNumber,
  hint,
  onSortChange,
  staticColShade    = 'default',
}: Props<T>) => {
  const isServerMode   = !!serverPagination;
  const isInfiniteMode = !!infiniteLoadMore;

  // ── 컬럼 순서 (DnD + localStorage) ────────────────────────────
  const lsKey      = storageKey ? `dnd-cols-${storageKey}`   : null;
  const lsSizeKey  = storageKey ? `col-sizes-${storageKey}${sizeVersion ? `-v${sizeVersion}` : ''}` : null;

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

  const dndSensors = useTableDndSensors();

  // ── 인덱스 컬럼 (항상 맨 앞, DnD·숨김 제외) ─────────────────
  // serverPagination은 매 렌더마다 새 객체 참조 → primitive로 분리해 useMemo deps 안정화
  const spPage     = serverPagination?.page     ?? 1;
  const spPageSize = serverPagination?.pageSize ?? 30;
  const indexCol: ColumnDef<T> = useMemo(() => ({
    id: '__index',
    header: 'NO.',
    enableSorting: false,
    enableResizing: false,
    size: 52,
    cell: ({ row, table: t }) => {
      // row.index는 원본 data 배열 기준 고정값이라 정렬 후에는 화면 위치와 어긋남 —
      // 반드시 현재 렌더링(정렬 반영)된 rows에서의 위치를 id로 다시 찾아야 함
      // 서버가 묶음 번호를 내려준 경우 그대로 사용 (페이지 간 연속성 보장)
      if (getRowNumber) return getRowNumber(row.original);

      const pageRows  = t.getRowModel().rows;
      const posInPage = pageRows.findIndex(r => r.id === row.id);
      const idx = posInPage >= 0 ? posInPage : row.index;

      // 병합 모드: 행이 아니라 "묶음" 단위로 번호를 매긴다 (매출/원가 2행 = 한 프로젝트 = 1번)
      // 페이지 내 순번이라 페이지를 넘기면 다시 1부터 시작한다.
      if (mergeRowsByKey) {
        let ordinal = 0;
        for (let i = 1; i <= idx && i < pageRows.length; i++) {
          if (mergeRowsByKey(pageRows[i].original) !== mergeRowsByKey(pageRows[i - 1].original)) ordinal++;
        }
        return ordinal + 1;
      }

      if (isServerMode) {
        return (spPage - 1) * spPageSize + idx + 1;
      }
      const { pageIndex, pageSize } = t.getState().pagination;
      return pageIndex * pageSize + idx + 1;
    },
  }), [isServerMode, spPage, spPageSize, mergeRowsByKey, getRowNumber]);

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

  // 정렬 상태 (controlled — onSortChange 콜백 연동)
  const [sorting, setSorting] = useState<import('@tanstack/react-table').SortingState>([]);

  // 클라이언트 검색 상태 (서버모드에선 사용 안 함)
  const [searchInput,      setSearchInput]      = useState('');
  const [globalFilter,     setGlobalFilter]     = useState('');
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(initialColumnVisibility);
  const [showColMenu,      setShowColMenu]      = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  // expandableRow — 더블클릭한 행 바로 아래에 콘텐츠 펼치기, 한 번에 하나만
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const closeExpanded = useCallback(() => setExpandedKey(null), []);
  const expandedRowRef = useRef<HTMLTableRowElement>(null);

  // 펼쳐진 행이 뷰포트 밖에 있으면 페이지 스크롤
  useEffect(() => {
    if (!expandedKey || !expandedRowRef.current) return;
    const timer = setTimeout(() => {
      const el = expandedRowRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (!inView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [expandedKey]);

  const tableWrapRef = useRef<HTMLDivElement>(null);
  const { highlightedCol, setHighlight, clearHighlight } = useColumnHighlight(tableWrapRef);

  // 셀 팝업은 항상 복사 가능 — 컬럼별 선별 없이 무조건 복사 기능 제공
  const { popup, copied: popupCopied, openPopup, closePopup, copyPopupText } = useClipboardPopup();

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
      sorting,
      globalFilter: isServerMode ? undefined : globalFilter,
      columnVisibility,
      columnSizing: colSizing,
      ...(storageKey && colOrder.length ? { columnOrder: colOrder } : {}),
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(next);
      onSortChange?.(next.length > 0 ? next[0].id : null);
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

  // compact 테이블(KPI 집계, 파트별 실적 등) — 고정형 소형 테이블이라 가로 스크롤이 없어야 함.
  // 컬럼 합계가 카드 폭과 다르면(좁든 넓든) 첫 진입 시 비례 조정해서 항상 폭에 꼭 맞춤.
  // 한 번만 실행(fittedRef) — FinanceCrossCheckPanel의 scaleToFill과 동일 패턴
  const compactFitRef = useRef(false);
  useEffect(() => {
    if (!compact || !storageKey || compactFitRef.current) return;
    const wrapEl = tableWrapRef.current;
    if (!wrapEl) return;
    const wrapW = wrapEl.clientWidth;
    const total = table.getTotalSize();
    if (!wrapW || total === wrapW) return;
    compactFitRef.current = true;
    const scale = wrapW / total;
    const next: Record<string, number> = {};
    table.getVisibleLeafColumns().forEach(col => {
      next[col.id] = Math.round(col.getSize() * scale);
    });
    setColSizing(next);
    if (lsSizeKey) localStorage.setItem(lsSizeKey, JSON.stringify(next));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact, storageKey, data.length]);

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

  const rows     = table.getRowModel().rows;
  // 병합(rowSpan) 시 뒤 행은 셀을 건너뛰어 :first-child 가 엉뚱한 컬럼에 걸림 →
  // 실제 첫 번째 보이는 컬럼 id 로 클래스를 붙여서 정렬/sticky 를 고정한다
  const firstColId = table.getVisibleLeafColumns()[0]?.id;

  // mergeRowsByKey 지정 시 연속된 같은 키 행끼리 묶는다 (미지정이면 1행 = 1그룹 → 기존 동작 그대로)
  const rowGroups = useMemo(() => {
    if (!mergeRowsByKey) return rows.map(r => [r]);
    const out: (typeof rows)[] = [];
    for (const r of rows) {
      const last = out[out.length - 1];
      if (last && mergeRowsByKey(last[0].original) === mergeRowsByKey(r.original)) last.push(r);
      else out.push([r]);
    }
    return out;
  }, [rows, mergeRowsByKey]);
  const filtered = isServerMode ? null : table.getFilteredRowModel().rows;

  // ── 서버/클라이언트 페이지네이션 통합 — 아래로는 이 값들만 쓰고 isServerMode를 다시 안 봄 ──
  const pagination = useMemo(() => {
    if (isServerMode) {
      const { page, pageSize: size, total, onPageChange, onPageSizeChange } = serverPagination!;
      return {
        pageIndex:   page - 1,
        pageSize:    size,
        pageCount:   Math.ceil(total / size),
        countLabel:  `${total}건`,
        goToPage:    (idx: number) => onPageChange(idx + 1),
        setPageSize: (n: number) => onPageSizeChange(n),
      };
    }
    const { pageIndex, pageSize: size } = table.getState().pagination;
    const countLabel = isInfiniteMode
      ? `${rows.length} / ${infiniteLoadMore!.total}건`
      : globalFilter && filtered
        ? `${filtered.length} / ${data.length}건`
        : `${data.length}건`;
    return {
      pageIndex,
      pageSize:    size,
      pageCount:   table.getPageCount(),
      countLabel,
      goToPage:    (idx: number) => table.setPageIndex(idx),
      setPageSize: (n: number) => { table.setPageSize(n); table.setPageIndex(0); },
    };
  }, [isServerMode, serverPagination, table, isInfiniteMode, infiniteLoadMore, globalFilter, filtered, data.length, rows.length]);

  // 실제 보여지는 행 수 기준 — pageSize를 다 못 채워도(검색 결과 적음) 그만큼만 여백 확보
  const dtRows = Math.max(MIN_TABLE_ROWS, Math.min(pagination.pageSize, rows.length));

  // ── 서버/클라이언트 검색 통합 ──
  const tableSearch = useMemo(() => {
    if (isServerMode) {
      const value = serverSearch?.value ?? '';
      return {
        value,
        hasValue:     value.length > 0,
        onChange:     (val: string) => serverSearch?.onChange(val),
        clear:        () => serverSearch?.onChange(''),
        fillFromCell: (text: string) => serverSearch?.onChange(text),
      };
    }
    return {
      value: searchInput,
      hasValue:     searchInput.length > 0,
      onChange:     (val: string) => { setSearchInput(val); table.setPageIndex(0); },
      clear:        () => { setSearchInput(''); setGlobalFilter(''); },
      fillFromCell: (text: string) => { setSearchInput(text); setGlobalFilter(text); },
    };
  }, [isServerMode, serverSearch, searchInput, table]);

  // Esc 우선순위 — 팝업 닫기 > 하이라이트 해제 > 검색 초기화
  useTableEscapePriority([
    { active: !!popup, run: closePopup },
    { active: !!highlightedCol, run: clearHighlight },
    { active: tableSearch.hasValue, run: tableSearch.clear },
  ]);

  const showSearch = searchable || !!serverSearch;
  const hasToolbarContent = pageSizeOptions.length > 1 ||
    (hideableColumns && hideableColumns.length > 0) ||
    showSearch || !!hint;

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
                value={pagination.pageSize}
                onChange={e => pagination.setPageSize(Number(e.target.value))}
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

          {hint && <span className={styles.toolbarHint}>{hint}</span>}

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
                value={tableSearch.value}
                onChange={e => tableSearch.onChange(e.target.value)}
              />
              {tableSearch.hasValue && (
                <Button variant="ghost" size="sm" className={styles.searchClear}
                  onClick={tableSearch.clear} aria-label="초기화">✕</Button>
              )}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className={styles.skeletonWrap}>
          {[...Array(6)].map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : rows.length === 0 ? (
        /* 결과 없음 — 테이블 자체를 그리지 않아 불필요한 가로 스크롤 방지 */
        <div className={styles.emptyInner}>
          <span className={styles.emptyIcon}>{emptyIcon}</span>
          <strong>{emptyTitle}</strong>
          <span>{emptyDescription}</span>
        </div>
      ) : (
        <div className={`${styles.scroll} ${isFetching ? styles.fetching : ''}`}>
          {/* DndContext를 table 바깥으로 — thead 안에 div 자식이 생기는 HTML 오류 방지 */}
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
          <table
            className={[
              styles.table,
              storageKey ? styles.tableFixed : '',
              stickyFirstCol ? styles.stickyFirst : '',
              staticColShade === 'soft' ? styles.staticColSoft : '',
            ].filter(Boolean).join(' ')}
            style={storageKey ? { width: table.getTotalSize() } : undefined}
          >
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
                          isFirst={h.column.id === firstColId}
                          isHighlighted={highlightedCol === h.column.id}
                          onHeaderClick={setHighlight}
                        />
                      ))}
                    </tr>
                  </SortableContext>
              ))}
            </thead>

            <tbody>
              {rowGroups.map(group => {
                // 그룹 안에서 모든 행의 값이 같은 컬럼 → 첫 행에만 rowSpan으로 한 칸 병합
                const mergedCols = group.length > 1
                  ? new Set(
                      group[0].getVisibleCells()
                        .filter(c => {
                          // NO.는 묶음당 하나 — 값 비교와 무관하게 항상 병합
                          if (c.column.id === '__index') return true;
                          const first = String(group[0].getValue(c.column.id) ?? '');
                          return group.every(r => String(r.getValue(c.column.id) ?? '') === first);
                        })
                        .map(c => c.column.id),
                    )
                  : new Set<string>();
                // 그룹 내 펼쳐진 행 — 펼침 패널은 그룹 마지막 행 뒤에 붙여야 rowSpan과 충돌하지 않음
                const expandedInGroup = expandableRow
                  ? group.find(r => expandableRow.getKey(r.original) === expandedKey)
                  : undefined;
                // 묶음의 손익 상태는 매출 행에만 있으므로 묶음 내 첫 비어있지 않은 variant를
                // 전체 행에 적용 — 좌측 바·하이라이트가 프로젝트 단위로 일관되게 보이도록
                const groupVariant = group.length > 1
                  ? (group.map(r => getRowVariant?.(r.original) ?? '').find(v => v) ?? '')
                  : '';
                return (
                <Fragment key={group[0].id}>
                  {group.map((row, i) => {
                    const variant = groupVariant || (getRowVariant?.(row.original) ?? '');
                    const expandKey = expandableRow?.getKey(row.original);
                    // 병합 묶음은 하이라이트도 묶음 전체에 — 2번째 행만 안 칠해지는 문제 방지
                    const isExpanded = !!expandedInGroup;
                    return (
                      <tr key={row.id} className={[variant ? styles[variant] : '', isExpanded ? styles.rowExpanded : ''].join(' ') || undefined}>
                        {row.getVisibleCells().map(cell => {
                          const isMerged = mergedCols.has(cell.column.id);
                          if (isMerged && i > 0) return null;   // 병합된 컬럼은 첫 행에서만 렌더
                          const raw = cell.getValue();
                          const text = raw != null && raw !== '' ? String(raw) : '';
                          const isLong = text.length > 20;
                          const canExpand = !!expandableRow && !expandableRow.excludeColumns?.includes(cell.column.id);
                          return (
                            <td
                              key={cell.id}
                              rowSpan={isMerged ? group.length : undefined}
                              title={text || undefined}
                              onClick={isLong ? () => openPopup(text, true) : undefined}
                              onDoubleClick={
                                canExpand
                                  ? () => setExpandedKey(k => k === expandKey ? null : expandKey!)
                                  : searchOnDblClick?.includes(cell.column.id) && text
                                    ? () => tableSearch.fillFromCell(text)
                                    : undefined
                              }
                              className={[
                                cell.column.id === firstColId ? styles.firstCol : '',
                                isMerged ? styles.spanCell : '',
                                isLong ? styles.clickable : '',
                                (canExpand || searchOnDblClick?.includes(cell.column.id)) ? styles.dblClickable : '',
                                cell.column.id === '__index' ? styles.indexCell : '',
                                cell.column.columnDef.meta?.staticCol ? styles.staticCol : '',
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
                  {expandedInGroup && (
                    <tr ref={expandedRowRef} className={styles.expandedRow}>
                      <td colSpan={table.getVisibleLeafColumns().length}>
                        {expandableRow!.renderContent(expandedInGroup.original, closeExpanded)}
                      </td>
                    </tr>
                  )}
                </Fragment>
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
          page={pagination.pageIndex + 1}
          pageCount={pagination.pageCount}
          onPageChange={p => pagination.goToPage(p - 1)}
        />
      )}

      <CellPopup title="셀 내용" popup={popup} copied={popupCopied} onClose={closePopup} onCopy={copyPopupText} />

    </div>
  );

  if (!title) return tableCard;

  return (
    <TableTitleBar title={title} count={!hideCount ? pagination.countLabel : undefined} toolbarExtra={toolbarExtra} info={info}>
      {tableCard}
    </TableTitleBar>
  );
};

export default DataTable;
