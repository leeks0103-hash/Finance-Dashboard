import { useState, useRef, useMemo, useCallback, useEffect, useLayoutEffect, Fragment, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { usePresence, usePageSwapClass } from '@/components/ui/useAnimatedClose';
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
import { FilterSelect } from '@/components/ui/FilterSelect';
import { LineIcon } from '@/components/ui/LineIcon';
import { prefersReducedMotion } from '@/utils/format';
import { useColumnHighlight } from './useColumnHighlight';
import { useClipboardPopup } from './useClipboardPopup';
import { useTableEscapePriority } from './useTableEscapePriority';
import { useTableDndSensors } from './useTableDndSensors';
import { SortableHeaderCell } from './SortableHeaderCell';
import { CellPopup } from './CellPopup';
import { TableTitleBar } from './TableTitleBar';
import styles from './DataTable.module.css';

// 펼침 패널 슬라이드 길이 — DataTable.module.css .expandSlide/.expandClosing 애니메이션과 맞출 것
// 펼침·접힘·본문 높이 전환은 모두 천천히 시작해 천천히 멈추는 같은 곡선(DataTable.module.css --dt-ease)을 씀(2026-10-02).
// 예전 곡선은 처음 몇 ms에 대부분 움직여 "뚝" 바뀌는 느낌이었음(검색 20행 → 5행에서 첫 프레임에 814 → 495px)
const EXPAND_OPEN_MS = 380;
const EXPAND_CLOSE_MS = 280;
// 검색 결과가 바뀔 때 본문 높이 전환 길이 — 0.32 → 0.4초(2026-10-01 요청, 1건으로 확 줄 때 너무 빨랐음)
const BODY_RESIZE_MS = 460;
const BODY_RESIZE_EASE = 'cubic-bezier(0.45, 0, 0.2, 1)';

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
  onHeaderClick: (columnId: string) => void;
  /** compact 표 전용(시범) — 리사이즈 시 테이블 총 폭을 고정하고 바로 옆 컬럼에서 폭을 빌려옴.
   *  기본 리사이즈(옆 컬럼은 안 건드리고 테이블만 넓어짐)는 미수주 프로젝트·KPI 집계처럼
   *  가로스크롤이 없어야 하는 표에서 "한 컬럼 넓히면 뒤 컬럼이 화면 밖으로 밀려남" 문제가 있었음 */
  fixedTotalWidth?: boolean;
}
function DraggableTh<T>({ header, isDraggable, isHighlighted, onHeaderClick, fixedTotalWidth }: DraggableThProps<T>) {
  const toggleSort = header.column.getToggleSortingHandler();
  const [selfResizing, setSelfResizing] = useState(false);

  // 옆 컬럼에서 폭을 빌려오는 리사이즈 — 합(=테이블 총 폭)이 항상 그대로 유지됨
  const handleFixedResize = (startEvent: ReactPointerEvent) => {
    const tanTable = header.getContext().table;
    const cols = tanTable.getVisibleLeafColumns();
    const idx = cols.findIndex(c => c.id === header.column.id);
    const isLast = idx === cols.length - 1;
    const neighbor = isLast ? cols[idx - 1] : cols[idx + 1];
    if (!neighbor) return;   // 빌려올 옆 컬럼이 없으면(컬럼 1개) 아무것도 안 함

    const startX = startEvent.clientX;
    const startSelfW = header.getSize();
    const startNeighborW = neighbor.getSize();
    const MIN_W = 60;
    const sign = isLast ? -1 : 1;   // 마지막 컬럼은 "앞" 컬럼에서 빌려오므로 부호가 뒤집힘

    setSelfResizing(true);
    const onMove = (e: PointerEvent) => {
      const rawDelta = (e.clientX - startX) * sign;
      const maxGrow = startNeighborW - MIN_W;          // 이웃이 줄어들 수 있는 최대치
      const maxShrink = -(startSelfW - MIN_W);          // 내가 줄어들 수 있는 최대치
      const delta = Math.max(maxShrink, Math.min(maxGrow, rawDelta));
      tanTable.setColumnSizing(prev => ({
        ...prev,
        [header.column.id]: startSelfW + delta,
        [neighbor.id]: startNeighborW - delta,
      }));
    };
    const onUp = () => {
      setSelfResizing(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <SortableHeaderCell
      id={header.id}
      isDraggable={isDraggable}
      isHighlighted={isHighlighted}
      highlightedClassName={styles.thHighlighted}
      className={[
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
          onPointerDown={e => {
            e.stopPropagation();
            if (fixedTotalWidth) handleFixedResize(e);
            else header.getResizeHandler()(e as never);
          }}
          onTouchStart={e => { e.stopPropagation(); if (!fixedTotalWidth) header.getResizeHandler()(e as never); }}
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
          className={`${styles.resizeHandle} ${(header.column.getIsResizing() || selfResizing) ? styles.resizing : ''}`}
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

/** 서버사이드 정렬 — 제공 시 머리글 클릭이 화면 정렬 대신 이 콜백을 부르고, 서버가 전체 기준으로 정렬해 줌 */
export interface ServerSorting {
  sortBy:   string | null;
  sortDir:  'asc' | 'desc';
  onChange: (sortBy: string | null, sortDir: 'asc' | 'desc') => void;
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
  /** 이 키의 행을 자동으로 펼침 — 값이 바뀔 때만 반응(사용자가 닫으면 같은 값 동안은 다시 안 열림).
   *  null로 바뀌면 자동으로 연 행을 닫음. 자동으로 열 땐 페이지 스크롤 안 함(검색창 입력 중이라) */
  autoExpandKey?:  string | null;
}

export type EmptyIconKind = 'search' | 'list';

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
  /** 결과가 적을 때 테이블 본문이 확보하는 최소 행 수(기본 5) — 검색 결과 패널처럼
   *  1~2건만 나와도 본문이 너무 작아 보이지 않아야 할 때 올려서 쓴다 */
  minRows?:           number;
  /** false면 본문 영역의 자체 스크롤(overflow:auto + min-height 예약)을 끄고 내용
   *  높이만큼만 자연스럽게 렌더 — 페이지 안에 짧게 끼워 넣는 결과 패널처럼 테이블
   *  자체가 스크롤 영역을 가질 필요 없을 때(기본 true, 2026-09-22) */
  scrollable?:        boolean;
  /** 부모 높이를 꽉 채움 — 표 본문만 안에서 세로 스크롤, 헤더·툴바·페이지 버튼은 제자리(모달 안 표용).
   *  부모가 높이가 정해진 칸이어야 함(flex 자식이면 min-height:0) */
  fillHeight?:        boolean;
  searchable?:        boolean;
  searchPlaceholder?: string;
  compact?:           boolean;
  hideToolbar?:       boolean;
  /** 건수 배지 숨김 — 고정 행 수 등 "건수"가 의미 없는 테이블용 */
  hideCount?:         boolean;
  /** 빈 상태 아이콘 — 검색 결과 없음이면 'search', 원래 비어 있는 목록이면 'list'.
   *  이모지(🔍📋📂)는 AI 냄새 난다는 피드백으로 얇은 선 아이콘으로 교체(2026-09-30) */
  emptyIcon?:         EmptyIconKind;
  emptyTitle?:        string;
  emptyDescription?:  string;
  searchDebounceMs?:  number;
  /** 서버사이드 페이지네이션 — 제공 시 클라이언트 페이지네이션 비활성화 */
  serverPagination?:  ServerPagination;
  /** 서버사이드 검색 — 제공 시 내부 검색 상태 비활성화 */
  serverSearch?:      ServerSearch;
  /** 서버사이드 정렬 — 서버 페이지네이션 표에서 전체 기준 정렬(없으면 받아 온 페이지 안에서만 정렬됨) */
  serverSorting?:     ServerSorting;
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
  /**
   * false면 컬럼 폭만 저장·복원하지 않음(순서·숨김은 storageKey대로 저장) — 들어올 때마다 컬럼 정의의
   * 기본 폭으로 보이고, 드래그·더블클릭 맞춤으로 바꾼 폭은 그 화면에서만 유지됨.
   * 더블클릭 맞춤 결과가 저장돼 다음 방문에도 정한 폭이 안 돌아오던 KPI 취합 목록용(2026-09-30)
   */
  persistColumnSizes?: boolean;
  /**
   * initialColumnVisibility에 컬럼을 추가/제거했을 때 올리는 값 — 저장된 표시/숨김 상태만
   * 무효화한다. 안 올리면 예전에 저장된 localStorage 값(당시엔 없던 컬럼이라 기본 숨김으로
   * 저장돼 있을 수 있음)이 새 기본값을 이겨서 컬럼이 계속 안 보이는 채로 남는다.
   */
  visibilityVersion?: string | number;
  /** 툴바 우측에 추가 렌더링할 요소 (뷰 전환 토글 등) */
  toolbarExtra?: ReactNode;
  /** 검색행 안, 검색범위 셀렉트와 입력창 사이에 끼워 넣을 요소 (파트/보고단계 필터 등) */
  searchExtra?: ReactNode;
  /** 제목 옆 ⓘ 버튼 — 클릭 시 데이터 기준 설명 팝오버 */
  info?: ReactNode;
  /** 제목줄 아래(툴바+표)에만 붙일 클래스 — TableTitleBar bodyClassName */
  bodyClassName?: string;
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
  /** 셀 렌더러가 참조할 부가 데이터 — TanStack table meta로 그대로 전달 (searchQuery와 병합) */
  meta?: Record<string, unknown>;
}

const DEFAULT_PAGE_SIZES = [10, 20, 30, 50, 100];
/** NO. 칸 고정 폭 */
const INDEX_COL_W = 52;
// 검색·필터로 행이 줄어도 최소 이 정도 높이는 유지 — 결과 1건일 때도 빈 상태처럼 휑해 보이지 않게
const MIN_TABLE_ROWS = 5;
/** 자동 펼침 지연 — 본문 높이 전환(BODY_RESIZE_MS)이 끝난 뒤 + 약간의 여유 */
const AUTO_EXPAND_DELAY_MS = 560;   // 본문 높이 전환(BODY_RESIZE_MS)이 끝난 뒤에 펼치도록 — 높이 전환보다 길게

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
  minRows           = MIN_TABLE_ROWS,
  scrollable        = true,
  fillHeight        = false,
  searchable        = false,
  searchPlaceholder = '검색… (Esc: 초기화)',
  compact           = false,
  hideToolbar       = false,
  hideCount         = false,
  emptyIcon         = 'search',
  emptyTitle        = '데이터가 없습니다.',
  emptyDescription  = '다른 검색어나 필터 조건을 시도해보세요.',
  searchDebounceMs  = 300,
  serverPagination,
  serverSearch,
  serverSorting,
  infiniteLoadMore,
  initialColumnVisibility = {},
  storageKey,
  sizeVersion,
  persistColumnSizes = true,
  visibilityVersion,
  toolbarExtra,
  searchExtra,
  info,
  bodyClassName,
  searchOnDblClick,
  expandableRow,
  mergeRowsByKey,
  getRowNumber,
  hint,
  onSortChange,
  staticColShade    = 'default',
  meta: extraMeta,
}: Props<T>) => {
  const isServerMode   = !!serverPagination;
  const isInfiniteMode = !!infiniteLoadMore;

  // ── 컬럼 순서 (DnD + localStorage) ────────────────────────────
  const lsKey      = storageKey ? `dnd-cols-${storageKey}`   : null;
  const lsSizeKey  = storageKey && persistColumnSizes
    ? `col-sizes-${storageKey}${sizeVersion ? `-v${sizeVersion}` : ''}` : null;
  const lsVisKey   = storageKey ? `col-visibility-${storageKey}${visibilityVersion ? `-v${visibilityVersion}` : ''}` : null;

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
    size: INDEX_COL_W,
    cell: ({ row, table: t }) => {
      // row.index는 원본 data 배열 기준 고정값이라 정렬 후에는 화면 위치와 어긋남 —
      // 반드시 현재 렌더링(정렬 반영)된 rows에서의 위치를 id로 다시 찾아야 함
      // 서버가 묶음 번호를 내려준 경우 그대로 사용 (페이지 간 연속성 보장) — 단, 사용자가
      // 다른 컬럼(예: 프로젝트명)을 클릭해 정렬을 바꾸면 그 고정값이 화면 순서와 안 맞아
      // "4,1,2,3"처럼 뒤섞여 보이므로, 정렬 중엔 getRowNumber를 쓰지 않고 항상 현재 화면
      // 순서를 그대로 따라가는 순번을 매긴다 (No.는 항상 순차적/역순이어야 함)
      const isSorted = t.getState().sorting.length > 0;
      if (getRowNumber && !isSorted) return getRowNumber(row.original);

      const pageRows  = t.getRowModel().rows;
      const posInPage = pageRows.findIndex(r => r.id === row.id);
      const idx = posInPage >= 0 ? posInPage : row.index;

      // 병합 모드: 행이 아니라 "묶음" 단위로 번호를 매긴다 (매출/원가 2행 = 한 프로젝트 = 1번)
      // 예전엔 현재 페이지 안에서만 세서 페이지를 넘기면 다시 1부터 시작했음(일반 표는 페이지를 넘어
      // 이어지는데 이것만 달랐음, 2026-09-29) → 페이지 나누기 전 전체 행 기준으로 세서 이어지게.
      // 서버 페이지네이션은 앞 페이지 행을 모르므로 기존처럼 페이지 안에서만
      if (mergeRowsByKey) {
        const all = isServerMode ? pageRows : t.getPrePaginationRowModel().rows;
        const pos = all.findIndex(r => r.id === row.id);
        let ordinal = 0;
        for (let i = 1; i <= pos; i++) {
          if (mergeRowsByKey(all[i].original) !== mergeRowsByKey(all[i - 1].original)) ordinal++;
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
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    if (!lsVisKey) return initialColumnVisibility;
    try {
      const saved: Record<string, boolean> = JSON.parse(localStorage.getItem(lsVisKey) ?? '{}');
      // 디폴트 위에 저장값을 얹음 — 사용자가 안 건드린 컬럼(신규 포함)은 디폴트 유지,
      // 건드린 컬럼은 껐든 켰든 그 상태 그대로 복원
      return { ...initialColumnVisibility, ...saved };
    } catch { return initialColumnVisibility; }
  });
  const [showColMenu,      setShowColMenu]      = useState(false);
  const [hoverGroupId,     setHoverGroupId]     = useState<string | null>(null);
  const colMenuDrop = usePresence(showColMenu);   // 닫힐 때도 퇴장 애니메이션(.closingDrop)
  const colMenuRef = useRef<HTMLDivElement>(null);

  // expandableRow — 더블클릭한 행 바로 아래에 콘텐츠 펼치기, 한 번에 하나만
  // 열 때·닫을 때 위아래로 슬라이드(.expandSlide) — 닫힘은 퇴장 애니메이션(EXPAND_CLOSE_MS)이 끝난 뒤 제거.
  // 다른 행을 더블클릭하면 순서대로: 기존 패널이 접히고(220ms) → 다 접힌 뒤 새 행에서 펼침.
  // 예전엔 기존 패널을 한 프레임에 통째로 빼고 바로 새로 펼쳐서, 위쪽 패널 높이만큼 표가 확 당겨졌다가
  // 다시 밀리며 크게 출렁였음(2026-10-01). 접히는 동안엔 누른 행이 화면에서 제자리에 있도록 스크롤을 같이 맞춤
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandClosing, setExpandClosing] = useState(false);
  // 슬라이드가 끝나면 overflow 클립을 풂 — 패널 안 표의 컬럼 메뉴 등 드롭다운이 잘리지 않게
  const [expandSettled, setExpandSettled] = useState(false);
  const expandTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(expandTimer.current), []);
  const closeExpanded = useCallback(() => {
    window.clearTimeout(expandTimer.current);
    if (prefersReducedMotion()) { setExpandedKey(null); return; }
    setExpandClosing(true);
    setExpandSettled(false);
    expandTimer.current = window.setTimeout(() => {
      setExpandedKey(null);
      setExpandClosing(false);
    }, EXPAND_CLOSE_MS);
  }, []);
  // 위쪽 패널이 접히는 동안 누른 행(anchor)이 화면에서 움직인 만큼 페이지를 같이 스크롤 — 행이 커서 아래 그대로.
  // 브라우저 스크롤 앵커링이 이미 맞춰준 만큼은 실제 이동량에 안 잡히므로 이중 보정 없음
  const keepRowInPlace = (anchor: Element | null, ms: number) => {
    if (!anchor) return;
    const top0 = anchor.getBoundingClientRect().top;
    const end = performance.now() + ms + 60;
    const tick = () => {
      if (!anchor.isConnected) return;
      const d = anchor.getBoundingClientRect().top - top0;
      if (Math.abs(d) > 0.5) window.scrollBy(0, d);
      if (performance.now() < end) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const toggleExpanded = useCallback((key: string, anchor: Element | null = null) => {
    if (expandedKey === key && !expandClosing) { closeExpanded(); return; }
    // 다른 행이 펼쳐져 있으면(또는 접히는 중이면) 먼저 접고, 다 접힌 뒤에 새 행을 펼침
    if (expandedKey && expandedKey !== key && !prefersReducedMotion()) {
      window.clearTimeout(expandTimer.current);
      if (!expandClosing) {
        setExpandClosing(true);
        setExpandSettled(false);
        keepRowInPlace(anchor, EXPAND_CLOSE_MS);
      }
      expandTimer.current = window.setTimeout(() => {
        setExpandClosing(false);
        setExpandSettled(false);
        setExpandedKey(key);
      }, EXPAND_CLOSE_MS);
      return;
    }
    window.clearTimeout(expandTimer.current);
    setExpandClosing(false);
    setExpandSettled(false);
    setExpandedKey(key);
  }, [expandedKey, expandClosing, closeExpanded]);

  // 자동 펼침(검색 결과에 재무 이력이 있을 때 등) — autoExpandKey가 바뀐 순간에만
  const autoExpandKey = expandableRow?.autoExpandKey ?? null;
  const lastAutoKey = useRef<string | null>(null);
  const skipExpandScroll = useRef(false);
  // 검색 결과가 바뀌며 본문 높이가 전환되는 중(bodyRef, BODY_RESIZE_MS)에 2뎁스까지 같이 펼치면 높이가 두 번 겹쳐
  // 출렁임(2026-09-30) → 표가 먼저 자리 잡은 뒤에 펼침. 그 사이 검색어가 또 바뀌면 예약 취소
  const autoExpandTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(autoExpandTimer.current), []);
  useEffect(() => {
    const prev = lastAutoKey.current;
    lastAutoKey.current = autoExpandKey;
    if (autoExpandKey === prev) return;
    window.clearTimeout(autoExpandTimer.current);
    if (autoExpandKey) {
      autoExpandTimer.current = window.setTimeout(() => {
        window.clearTimeout(expandTimer.current);
        skipExpandScroll.current = true;
        setExpandClosing(false);
        setExpandSettled(false);
        setExpandedKey(autoExpandKey);
      }, prefersReducedMotion() ? 0 : AUTO_EXPAND_DELAY_MS);
    } else if (prev && expandedKey === prev) {
      closeExpanded();
    }
  }, [autoExpandKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const expandedRowRef = useRef<HTMLTableRowElement>(null);

  // 펼쳐진 행이 뷰포트 밖에 있으면 페이지 스크롤
  useEffect(() => {
    if (!expandedKey || !expandedRowRef.current) return;
    if (skipExpandScroll.current) { skipExpandScroll.current = false; return; }
    const timer = setTimeout(() => {
      const el = expandedRowRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (!inView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, prefersReducedMotion() ? 80 : EXPAND_OPEN_MS);   // 슬라이드로 다 펼쳐진 뒤 높이 기준
    return () => clearTimeout(timer);
  }, [expandedKey]);

  const tableWrapRef = useRef<HTMLDivElement>(null);
  const { highlightedCol, setHighlight, clearHighlight } = useColumnHighlight(tableWrapRef);
  // compact 폭 맞춤 전용 — .wrapper(바깥 카드)가 아니라 실제 가로 스크롤이 일어나는 .scroll의
  // 폭을 재야 함. 세로 스크롤바가 뜨면 .scroll의 실제 가용폭은 .wrapper보다 스크롤바 폭만큼
  // 좁아지는데, 지금까지 tableWrapRef(.wrapper) 기준으로 재서 그만큼 항상 더 넓게 계산되고
  // 있었음 — compact 테이블에서 가로스크롤이 안 없어지던 원인 중 하나(2026-09-18 발견)
  const scrollWrapRef = useRef<HTMLDivElement>(null);

  // 셀 팝업은 항상 복사 가능 — 컬럼별 선별 없이 무조건 복사 기능 제공
  const { popup, copied: popupCopied, openPopup, closePopup, copyPopupText } = useClipboardPopup();

  useEffect(() => {
    if (isServerMode) return;
    const timer = setTimeout(() => setGlobalFilter(searchInput.trim()), searchDebounceMs);
    return () => clearTimeout(timer);
  }, [searchInput, searchDebounceMs, isServerMode]);

  const searchQuery = isServerMode ? (serverSearch?.value ?? '') : globalFilter;

  // NO. 칸 폭은 항상 INDEX_COL_W — 예전 compact 비례 맞춤이 저장해둔 __index 폭(80~90px로 늘어난 값)은 무시
  const colSizingNoIndex = useMemo(
    () => Object.fromEntries(Object.entries(colSizing).filter(([k]) => k !== '__index')),
    [colSizing],
  );

  const table = useReactTable({
    data,
    columns: columnsWithIndex,
    meta: { searchQuery, ...extraMeta },
    state: {
      // 서버 정렬이면 상태도 서버 정렬 값을 그대로 보여줌(머리글 화살표)
      sorting: serverSorting
        ? (serverSorting.sortBy ? [{ id: serverSorting.sortBy, desc: serverSorting.sortDir === 'desc' }] : [])
        : sorting,
      globalFilter: isServerMode ? undefined : globalFilter,
      columnVisibility,
      columnSizing: colSizingNoIndex,
      ...(storageKey && colOrder.length ? { columnOrder: colOrder } : {}),
    },
    onSortingChange: (updater) => {
      if (serverSorting) {
        const cur = serverSorting.sortBy ? [{ id: serverSorting.sortBy, desc: serverSorting.sortDir === 'desc' }] : [];
        const next = typeof updater === 'function' ? updater(cur) : updater;
        serverSorting.onChange(next[0]?.id ?? null, next[0]?.desc ? 'desc' : 'asc');
        return;
      }
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(next);
      onSortChange?.(next.length > 0 ? next[0].id : null);
    },
    columnResizeMode: storageKey ? 'onChange' : undefined,
    getRowId,
    onGlobalFilterChange:     isServerMode ? undefined : setGlobalFilter,
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (lsVisKey) localStorage.setItem(lsVisKey, JSON.stringify(next));
        return next;
      });
    },
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
    // 서버 정렬 — 받은 순서 그대로 보여줌(화면에서 다시 정렬하지 않음)
    ...(serverSorting && { manualSorting: true }),
  });

  // compact 테이블(KPI 집계, 파트별 실적 등) — 고정형 소형 테이블이라 가로 스크롤이 없어야 함.
  // 컬럼 합계가 카드 폭과 다르면(좁든 넓든) 첫 진입 시 비례 조정해서 항상 폭에 꼭 맞춤.
  // ⚠️ 이미 저장된 폭(colSizing)이 있으면 건드리지 않는다 — 안 그러면 컴포넌트가 리마운트될 때마다
  //    "이미 축소된 값"을 또 축소해서 테이블이 계속 줄어든다(part 필터 전환 시 재현됨).
  const compactFitRef = useRef(false);
  useEffect(() => {
    if (!compact || !storageKey || compactFitRef.current) return;
    if (Object.keys(colSizing).length > 0) { compactFitRef.current = true; return; }  // 저장된 폭 존중
    const wrapEl = scrollWrapRef.current;
    if (!wrapEl) return;
    // 여기서 맞추는 건 컬럼 간 "비율"일 뿐, 테이블 자체 렌더 폭은 이제 항상 CSS width:100%가
    // 최종 보장함(아래 <table> style 참고) — 그래서 1~2px 정도의 반올림/테두리 오차는
    // 더 이상 실제 오버플로우로 안 이어짐
    const wrapW = wrapEl.clientWidth;
    const total = table.getTotalSize();
    if (!wrapW || total === wrapW) return;
    compactFitRef.current = true;
    // NO. 칸은 비례 맞춤에서 제외 — 같이 늘리면 번호 칸만 쓸데없이 넓어졌음(2026-09-29)
    const idxW  = table.getColumn('__index')?.getIsVisible() ? INDEX_COL_W : 0;
    const scale = (wrapW - idxW) / (total - idxW);
    const next: Record<string, number> = {};
    const cols = table.getVisibleLeafColumns().filter(col => col.id !== '__index');
    cols.forEach(col => {
      next[col.id] = Math.round(col.getSize() * scale);
    });
    // 컬럼마다 개별 반올림하면 오차가 쌓여 합계가 wrapW보다 몇 px 넘치거나 모자랄 수 있음
    // ("테이블이 꽉 안 찬다"/살짝 넘치는 원인) — 가장 넓은 컬럼에서 그 차이만큼 보정해서
    // 합계가 컨테이너 폭과 정확히 같아지게 함
    const drift = wrapW - idxW - cols.reduce((sum, col) => sum + next[col.id], 0);
    if (drift !== 0 && cols.length > 0) {
      const widest = cols.reduce((a, b) => (next[a.id] >= next[b.id] ? a : b));
      next[widest.id] += drift;
    }
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

  // 페이지 넘김 — 새 페이지 행이 뚝 바뀌지 않고 살짝 올라오며 나타남(서버 모드는 새 데이터가 도착한 뒤)
  // 검색·정렬로 행이 바뀔 때도 같은 등장 효과 — 페이지 번호만 보면 검색 결과가 바뀔 땐 행이 뚝 갈렸음(2026-10-02).
  // 키는 실제로 받은 행(개수·첫 행) 기준이라 타이핑 중(디바운스 대기)에는 안 걸리고 새 결과가 온 순간에만 걸림
  const pageSwapClass = usePageSwapClass(`${pagination.pageIndex}|${rows.length}|${rows[0]?.id ?? ''}`, isFetching);

  // 실제 보여지는 행 수 기준 — pageSize를 다 못 채워도(검색 결과 적음) 그만큼만 여백 확보.
  // 단 페이지가 여러 장이면 한 페이지 높이(pageSize행)를 유지 — 행이 적은 마지막 페이지로 넘기면 표가 뚝 줄었음
  // (2026-10-02, 프로젝트 상세 676 → 100px). 결과가 한 페이지에 다 들어가는 경우(검색 1건 등)는 예전처럼 그만큼만
  const dtRows = pagination.pageCount > 1
    ? Math.max(minRows, pagination.pageSize)
    : Math.max(minRows, Math.min(pagination.pageSize, rows.length));

  // ── 본문 높이 전환 ──
  // 검색으로 행 수가 확 줄거나(1건) 표 ↔ "결과 없음"이 바뀌면(다른 요소라 CSS 전환이 안 먹음)
  // 높이가 한 프레임에 뚝 바뀌어 싸 보였음(2026-09-30). 본문+페이지 버튼을 한 칸(bodyRef)으로 묶고,
  // 내용이 바뀌는 순간에만 "직전 높이 → 새 높이"로 이어 줌. 평소엔 높이 auto라 행 펼침(2뎁스) 등은 그대로
  const bodyRef = useRef<HTMLDivElement>(null);
  const lastBodyH = useRef(0);
  // 마지막으로 알고 있던 페이지 스크롤 위치 — 아래 전환에서 브라우저가 스크롤을 잘라 먹은 걸 되돌릴 때 씀
  const lastScrollY = useRef(0);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { if (!el.style.height) lastBodyH.current = el.offsetHeight; });
    ro.observe(el);
    const onScroll = () => { lastScrollY.current = window.scrollY; };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { ro.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);
  const bodyKey = isLoading ? 'loading' : `${rows.length}|${pagination.pageCount > 1}`;
  useLayoutEffect(() => {
    const el = bodyRef.current;
    const from = lastBodyH.current;
    if (!el || !from || prefersReducedMotion()) return;
    const to = el.offsetHeight;
    if (Math.abs(from - to) < 2) return;
    el.style.overflow = 'hidden';
    el.style.height = `${from}px`;
    void el.offsetHeight;   // 시작 높이를 먼저 확정시켜야 전환이 걸림
    // 새 높이를 재는 순간(위 offsetHeight) 문서가 잠깐 짧아져, 페이지 맨 아래를 보고 있었다면 브라우저가 스크롤을
    // 그만큼 한 번에 잘라 먹음 → 표가 줄기도 전에 화면 전체가 수백 px 튀었음(2026-10-01). 시작 높이를 다시 걸었으니
    // 원래 위치로 되돌리고, 줄어드는 동안 프레임마다 조금씩 따라 올라가게 둠
    if (Math.abs(window.scrollY - lastScrollY.current) > 1) window.scrollTo({ top: lastScrollY.current, behavior: 'instant' });
    el.style.transition = `height ${BODY_RESIZE_MS}ms ${BODY_RESIZE_EASE}`;
    el.style.height = `${to}px`;
    const clear = () => { el.style.height = ''; el.style.overflow = ''; el.style.transition = ''; };
    let done = false;
    const t = window.setTimeout(() => { done = true; clear(); lastBodyH.current = el.offsetHeight; }, BODY_RESIZE_MS + 20);
    return () => {
      // 이미 끝난 전환이면 손대지 않음 — 이 정리 함수는 다음 내용이 DOM에 들어간 "뒤"에 불려서, 여기서 높이를 재면
      // 새 높이가 "직전 높이"로 덮여 다음 전환이 아예 안 걸렸음(검색해서 1건이 되면 뚝 줄던 원인, 2026-10-01)
      if (done) return;
      // 전환 도중 또 바뀌면 지금 보이는 높이에서 이어가게(인라인 높이가 걸려 있어 새 내용과 무관하게 현재 높이가 잡힘)
      window.clearTimeout(t);
      const cur = el.getBoundingClientRect().height;
      clear();
      lastBodyH.current = cur;
    };
  }, [bodyKey]);

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
      className={`${styles.wrapper} ${compact ? styles.compact : ''} ${fillHeight ? styles.fill : ''}`}
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
                {colMenuDrop.mounted && (
                  <div className={`${styles.colMenu}${hideableColumns.length > 12 ? ` ${styles.colMenuGrid}` : ''}${colMenuDrop.closing ? ' closingDrop' : ''}`}>
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
              {/* searchExtra(파트/보고단계/진행단계 등 추가 필터)는 검색범위 select 앞에 —
                  검색범위는 입력창과 한 쌍으로 붙어 있어야 "이게 검색 옵션"이라는 게 바로
                  읽힘(2026-09-21 요청, KPI·재무 공통) */}
              {searchExtra}
              {serverSearch?.fieldOptions && (
                <FilterSelect
                  value={serverSearch.field ?? ''}
                  onChange={f => serverSearch.onFieldChange?.(f)}
                  options={serverSearch.fieldOptions}
                  allLabel={null}   /* fieldOptions에 이미 {value:'',label:'전체'} 포함 */
                  ariaLabel="검색 범위"
                />
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

      <div ref={bodyRef} className={fillHeight ? styles.fillBody : undefined}>
      {isLoading ? (
        <div className={styles.skeletonWrap}>
          {[...Array(6)].map((_, i) => <div key={i} className={styles.skeletonRow} />)}
        </div>
      ) : rows.length === 0 ? (
        /* 결과 없음 — 테이블 자체를 그리지 않아 불필요한 가로 스크롤 방지 */
        <div className={styles.emptyInner}>
          <LineIcon kind={emptyIcon} className={styles.emptyIcon} />
          <strong>{emptyTitle}</strong>
          <span>{emptyDescription}</span>
        </div>
      ) : (
        <div ref={scrollWrapRef} className={`${styles.scroll} ${isFetching ? styles.fetching : ''} ${!scrollable ? styles.noScroll : ''}`}>
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
              staticColShade === 'soft' ? styles.staticColSoft : '',
              !scrollable ? styles.tableNoMinWidth : '',
            ].filter(Boolean).join(' ')}
            /* compact는 인라인 px 폭을 안 줌 — .table의 width:100% CSS가 그대로 적용돼
               테이블이 항상 부모 폭에 정확히 맞춰짐. table-layout:fixed에서 각 th의 px 폭은
               "비율"로만 쓰이므로, colSizing 합이 1~2px 어긋나도(반올림 오차) 브라우저가
               100% 안에 비례로 맞춰 그려서 더 이상 안 넘침 — JS로 정확한 px 합을 맞추려
               애쓰던 것(반올림 보정·테두리 보정)보다 훨씬 견고함 */
            style={storageKey && !compact ? { width: table.getTotalSize() } : undefined}
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
                          isHighlighted={highlightedCol === h.column.id}
                          onHeaderClick={setHighlight}
                          fixedTotalWidth={compact}
                        />
                      ))}
                    </tr>
                  </SortableContext>
              ))}
            </thead>

            <tbody className={pageSwapClass}>
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
                    // 묶음 호버 — 한 행에 올려도 묶음 전체(병합 셀 포함)를 칠함. 병합 셀은 rowSpan이라
                    // 행 단위 :hover로는 안 칠해졌음(NO.·프로젝트코드 호버 없음, 2026-09-29)
                    const isGroup = group.length > 1;
                    return (
                      <tr
                        key={row.id}
                        className={[
                          variant ? styles[variant] : '',
                          isExpanded ? styles.rowExpanded : '',
                          isGroup && hoverGroupId === group[0].id ? styles.groupHover : '',
                        ].join(' ').trim() || undefined}
                        onMouseEnter={isGroup ? () => setHoverGroupId(group[0].id) : undefined}
                        onMouseLeave={isGroup ? () => setHoverGroupId(null) : undefined}
                      >
                        {row.getVisibleCells().map(cell => {
                          const isMerged = mergedCols.has(cell.column.id);
                          if (isMerged && i > 0) return null;   // 병합된 컬럼은 첫 행에서만 렌더
                          const raw = cell.getValue();
                          const text = raw != null && raw !== '' ? String(raw) : '';
                          const isLong = text.length > 20 && !!cell.column.columnDef.meta?.cellPopup;
                          const canExpand = !!expandableRow && !expandableRow.excludeColumns?.includes(cell.column.id);
                          const formatTitle = cell.column.columnDef.meta?.formatTitle;
                          const cellTitle = formatTitle ? formatTitle(raw) : (text || undefined);
                          const isMuted = !!cell.column.columnDef.meta?.cellMuted?.(row.original);
                          const flag = cell.column.columnDef.meta?.cellFlag?.(row.original);
                          const tint = cell.column.columnDef.meta?.cellTint?.(row.original);
                          const glow = !!cell.column.columnDef.meta?.cellGlow?.(row.original);
                          return (
                            <td
                              key={cell.id}
                              rowSpan={isMerged ? group.length : undefined}
                              title={flag ?? cellTitle}
                              onClick={isLong ? () => {
                                const onOpenFile = cell.column.columnDef.meta?.onOpenFile;
                                // 팝업 제목 = 클릭한 컬럼 이름(파일명·비고…) — 예전엔 전부 "셀 내용"
                                const header = cell.column.columnDef.header;
                                openPopup(text, true, onOpenFile ? () => onOpenFile(text) : undefined,
                                  typeof header === 'string' ? header : cell.column.id);
                              } : undefined}
                              onDoubleClick={
                                canExpand
                                  ? (e: React.MouseEvent) => toggleExpanded(expandKey!, (e.currentTarget as Element).closest('tr'))
                                  : searchOnDblClick?.includes(cell.column.id) && text
                                    ? () => tableSearch.fillFromCell(text)
                                    : undefined
                              }
                              className={[
                                isMerged ? styles.spanCell : '',
                                isLong ? styles.clickable : '',
                                (canExpand || searchOnDblClick?.includes(cell.column.id)) ? styles.dblClickable : '',
                                cell.column.id === '__index' ? styles.indexCell : '',
                                cell.column.columnDef.meta?.staticCol ? styles.staticCol : '',
                                cell.column.columnDef.meta?.emphasisCol ? styles.emphasisCol : '',
                                highlightedCol === cell.column.id ? styles.tdHighlighted : '',
                                isMuted ? styles.cellMuted : '',
                                flag ? styles.cellFlagged : '',
                                tint === 'static' ? styles.tintStatic : tint === 'filled' ? styles.tintFilled : '',
                                glow ? styles.cellGlow : '',
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
                        <div
                          key={expandedKey}
                          className={[
                            styles.expandSlide,
                            expandClosing ? styles.expandClosing : '',
                            expandSettled ? styles.expandSettled : '',
                          ].join(' ')}
                          onAnimationEnd={e => {
                            if (e.target === e.currentTarget && !expandClosing) setExpandSettled(true);
                          }}
                        >
                          <div className={styles.expandInner}>
                            {expandableRow!.renderContent(expandedInGroup.original, closeExpanded)}
                          </div>
                        </div>
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
      </div>

      <CellPopup title="내용" popup={popup} copied={popupCopied} onClose={closePopup} onCopy={copyPopupText} />

    </div>
  );

  if (!title) return tableCard;

  return (
    <TableTitleBar title={title} count={!hideCount ? pagination.countLabel : undefined} toolbarExtra={toolbarExtra} info={info} bodyClassName={bodyClassName} fill={fillHeight}>
      {tableCard}
    </TableTitleBar>
  );
};

export default DataTable;
