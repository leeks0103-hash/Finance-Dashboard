import { useState, useMemo, useCallback, useRef, type ReactNode } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, horizontalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CopyText, Button, Pagination } from '@/components/ui';
import styles from './KpiRawTable.module.css';

export const KPI_METRICS = [
  { key: 'NPS',               label: '교육 만족도 (NPS)' },
  { key: '전략기술과정_건수', label: '그룹 연구개발 2030 전략기술 관련 과정 개발 (과정 건수)' },
  { key: '전략기술과정_적절성', label: '그룹 연구개발 2030 전략기술 관련 과정 개발 (교육 내용 구성 적절성)' },
  { key: '특화교육체계_건수', label: '본부별/그룹사별 특화 교육체계 구축 (프로젝트 건수)' },
  { key: 'AI교육_고객사건수', label: '그룹 내 AI 교육 확대 (고객사 건수)' },
  { key: 'AI교육_적절성',    label: '그룹 내 AI 교육 확대 (교육 내용 구성 적절성)' },
  { key: '신사업_매출억',    label: '정부지원 사업 및 신사업 확대 (매출액, 단위 : 억)' },
  { key: '신사업_신규기존건수', label: '정부지원 사업 및 신사업 확대 (신규/기존 사업 건수)' },
] as const;

export type KpiRawRow = Record<string, unknown>;

// ── 컬럼 정의 ────────────────────────────────────────────────
interface ColDef {
  id:          string;
  header:      string;
  rowspan:     boolean;  // true = 프로젝트당 1셀 (rowSpan=8)
  defaultWidth: number;
  getValue:    (row: KpiRawRow, metricKey?: string) => string;
}

const COLS: ColDef[] = [
  { id: 'code',        header: '프로젝트코드',       rowspan: true,  defaultWidth: 140, getValue: r => String(r['프로젝트코드'] ?? '') },
  { id: 'year',        header: '수행연도',            rowspan: true,  defaultWidth: 90,  getValue: r => String(r['수행연도'] ?? '') },
  { id: 'part',        header: '파트명',              rowspan: true,  defaultWidth: 80,  getValue: r => String(r['파트명'] ?? '') },
  { id: 'stage',       header: '보고단계',            rowspan: true,  defaultWidth: 80,  getValue: r => String(r['보고단계'] ?? '') },
  { id: 'label',       header: '구분',                rowspan: false, defaultWidth: 290, getValue: (_, k) => KPI_METRICS.find(m => m.key === k)?.label ?? '' },
  { id: 'plan',        header: "'26년 목표\n(사업계획)", rowspan: false, defaultWidth: 90, getValue: (r, k) => cellVal(r[`${k}_사업계획`]) },
  { id: 'target',      header: "'26년 목표\n(프로젝트)", rowspan: false, defaultWidth: 90, getValue: (r, k) => cellVal(r[`${k}_PJ목표`]) },
  { id: 'actual',      header: "'26년 실적\n(프로젝트)", rowspan: false, defaultWidth: 90, getValue: (r, k) => cellVal(r[`${k}_PJ실적`]) },
  { id: 'similar',     header: "'25년 실적\n(유사)",    rowspan: false, defaultWidth: 90,  getValue: (r, k) => cellVal(r[`${k}_PJ유사`]) },
  { id: 'note',        header: '비고',                 rowspan: false, defaultWidth: 200, getValue: (r, k) => {
    const v = r[`${k}_비고`];
    return (v === null || v === undefined || v === '' || v === 0) ? '' : String(v);
  }},
  { id: 'processedAt', header: '처리일시',             rowspan: true,  defaultWidth: 150, getValue: r => String(r['처리일시'] ?? '') },
  { id: 'modifiedAt',  header: '최종수정일시',         rowspan: true,  defaultWidth: 150, getValue: r => String(r['최종수정일시'] ?? '') },
  { id: 'filename',    header: '파일명',               rowspan: true,  defaultWidth: 200, getValue: r => String(r['파일명'] ?? '') },
];

const LS_ORDER = 'kpi-raw-col-order';
const LS_SIZES = 'kpi-raw-col-sizes';

function loadFromLS<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
}

function cellVal(v: unknown): string {
  if (v === null || v === undefined || v === '' || v === 0 || v === '0') return '-';  // 미입력
  const s = String(v).trim();
  if (s === 'N' || s === 'n') return 'N';  // 명시적 해당없음
  return s;
}

// ── DnD 가능한 th ────────────────────────────────────────────
interface DraggableThProps {
  col:    ColDef;
  width:  number;
  onResizeStart: (colId: string, startX: number, startW: number) => void;
}
function DraggableTh({ col, width, onResizeStart }: DraggableThProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.id });

  return (
    <th
      ref={setNodeRef}
      style={{
        width,
        minWidth: width,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
        position: 'relative',
        whiteSpace: 'pre-line',
      }}
      {...attributes}
      {...listeners}
    >
      {col.header}
      <div
        className={styles.resizeHandle}
        onPointerDown={e => { e.stopPropagation(); onResizeStart(col.id, e.clientX, width); }}
        onClick={e => e.stopPropagation()}
      />
    </th>
  );
}

// ── Props ────────────────────────────────────────────────────
interface Props {
  data: KpiRawRow[];
  isLoading?: boolean;
  isFetching?: boolean;
  title?: string;
  toolbarExtra?: ReactNode;
  serverPagination?: {
    total: number; page: number; pageSize: number;
    onPageChange: (p: number) => void;
    onPageSizeChange: (s: number) => void;
  };
  serverSearch?: { value: string; onChange: (v: string) => void };
}

const KpiRawTable = ({ data, isLoading, isFetching, title, toolbarExtra, serverPagination, serverSearch }: Props) => {
  // ── 컬럼 순서 ─────────────────────────────────────────────
  const [colOrder, setColOrder] = useState<string[]>(() =>
    loadFromLS(LS_ORDER, COLS.map(c => c.id))
  );
  const orderedCols = useMemo(
    () => colOrder.map(id => COLS.find(c => c.id === id)!).filter(Boolean),
    [colOrder],
  );

  // ── 컬럼 너비 ─────────────────────────────────────────────
  const defaultSizes = useMemo(() => Object.fromEntries(COLS.map(c => [c.id, c.defaultWidth])), []);
  const [colSizes, setColSizes] = useState<Record<string, number>>(() =>
    loadFromLS(LS_SIZES, defaultSizes)
  );

  // ── 리사이즈 ──────────────────────────────────────────────
  const resizeRef = useRef<{ id: string; startX: number; startW: number } | null>(null);

  const handleResizeStart = useCallback((colId: string, startX: number, startW: number) => {
    resizeRef.current = { id: colId, startX, startW };

    const onMove = (e: PointerEvent) => {
      if (!resizeRef.current) return;
      const { id, startX, startW } = resizeRef.current;
      const newW = Math.max(50, startW + e.clientX - startX);
      setColSizes(prev => {
        const next = { ...prev, [id]: newW };
        localStorage.setItem(LS_SIZES, JSON.stringify(next));
        return next;
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, []);

  // ── DnD ───────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setColOrder(prev => {
      const next = arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id)));
      localStorage.setItem(LS_ORDER, JSON.stringify(next));
      return next;
    });
  }, []);

  // ── 페이지네이션 ──────────────────────────────────────────
  const pageCount  = serverPagination ? Math.ceil(serverPagination.total / serverPagination.pageSize) : 1;
  const totalLabel = serverPagination ? `${serverPagination.total}건` : `${data.length}건`;

  return (
    <div className={styles.wrapper}>
      {/* 툴바 */}
      <div className={styles.toolbar}>
        {title && <span className={styles.title}>{title}</span>}
        <span className={styles.count}>{totalLabel}</span>
        {serverPagination && (
          <select className={styles.pageSizeSelect} value={serverPagination.pageSize}
            onChange={e => serverPagination.onPageSizeChange(Number(e.target.value))}>
            {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n}행</option>)}
          </select>
        )}
        {serverSearch && (
          <div className={styles.searchWrap}>
            <input className={styles.search} placeholder="프로젝트코드·파트명 검색…"
              value={serverSearch.value}
              onChange={e => serverSearch.onChange(e.target.value)} />
            {serverSearch.value && (
              <Button variant="ghost" size="sm" className={styles.searchClear} onClick={() => serverSearch.onChange('')}>✕</Button>
            )}
          </div>
        )}
        {toolbarExtra}
      </div>

      {/* 테이블 */}
      <div className={`${styles.scroll} ${isFetching ? styles.fetching : ''}`}>
        {isLoading ? (
          <div className={styles.skeletonWrap}>
            {[...Array(8)].map((_, i) => <div key={i} className={styles.skeletonRow} />)}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className={styles.table} style={{ tableLayout: 'fixed', width: orderedCols.reduce((s, c) => s + (colSizes[c.id] ?? c.defaultWidth), 0) }}>
            <colgroup>
              {orderedCols.map(c => <col key={c.id} style={{ width: colSizes[c.id] ?? c.defaultWidth }} />)}
            </colgroup>
              <SortableContext items={orderedCols.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                <thead>
                  <tr>
                    {orderedCols.map(c => (
                      <DraggableTh
                        key={c.id}
                        col={c}
                        width={colSizes[c.id] ?? c.defaultWidth}
                        onResizeStart={handleResizeStart}
                      />
                    ))}
                  </tr>
                </thead>
              </SortableContext>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={orderedCols.length} className={styles.empty}>데이터가 없습니다.</td></tr>
              ) : data.map(row => {
                const code = String(row['프로젝트코드'] ?? '');
                return KPI_METRICS.map((m, mi) => (
                  <tr key={`${code}-${mi}`} className={mi % 2 === 0 ? styles.even : ''}>
                    {orderedCols.map(col => {
                      // rowspan 컬럼은 첫 번째 KPI 행에만 출력
                      if (col.rowspan && mi > 0) return null;
                      const val = col.getValue(row, m.key);
                      return (
                        <td
                          key={col.id}
                          rowSpan={col.rowspan ? KPI_METRICS.length : 1}
                          className={`${col.rowspan ? styles.spanCell : ''} ${col.id === 'label' ? styles.labelCell : col.rowspan ? styles.metaCell : styles.numCell}`}
                          title={val}
                        >
                          {col.id === 'code' ? <CopyText text={val} /> : val || 'N'}
                        </td>
                      );
                    })}
                  </tr>
                ));
              })}
            </tbody>
          </table>
          </DndContext>
        )}
      </div>

      {/* 페이지네이션 */}
      {serverPagination && (
        <Pagination
          page={serverPagination.page}
          pageCount={pageCount}
          onPageChange={serverPagination.onPageChange}
        />
      )}
    </div>
  );
};

export default KpiRawTable;
