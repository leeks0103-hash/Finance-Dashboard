import { useState, useMemo, useCallback } from 'react';
import {
  DndContext, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, DoughnutChart, useTableDndSensors } from '@/components/ui';
import BigCostDoughnut from './BigCostDoughnut';
import { stripPartPrefix } from '@/utils';
import styles from './CostBreakdownModal.module.css';

interface CostData {
  labels: string[];
  values: number[];
}

interface Props {
  total:      CostData;
  byPart:     Record<string, CostData>;
  partsRaw:   string[];
  teams:      string[];
  teamParts:  Record<string, string[]>;
  colors:     string[];
  showLabels: boolean;
  /** 왼쪽 큰 도넛(항상 전사평균)의 조각 클릭 — 그 원가 항목의 프로젝트별 산출근거 표를 연다 */
  onSliceClick: (seriesIndex: number) => void;
}

const COST_LABELS = ['직접원가', '인건비', '공통원가', '관리비', '경상손익'];

const loadOrder = (key: string): string[] => {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
};

interface Cell { key: string; label: string; data: CostData }

// ── 드래그 가능한 미니 카드 — 이 그리드 안에서만 순서 교체됨(다른 영역과 무관) ──
function SortableCard({ cell, colors, showLabels, cols4, onExpand }: {
  cell: Cell; colors: string[]; showLabels: boolean; cols4: boolean;
  onExpand: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cell.key });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
      }}
      className={styles.partCard}
    >
      {/* 드래그 센서가 pointerdown을 가로채지 않도록 stopPropagation — 클릭만 확대 토글 */}
      <Button
        unstyled
        className={styles.expandBtn}
        title="확대해서 전사평균과 비교"
        aria-label="확대"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onExpand(cell.key); }}
      >
        ⤢
      </Button>
      <span className={styles.partLabel}>{cell.label}</span>
      <div className={styles.smallChart}>
        <DoughnutChart
          labels={cell.data.labels}
          data={cell.data.values}
          colors={colors}
          showLabels={showLabels}
          outsideLabels
          outsideLabelsSize={cols4 ? 'sm' : 'sm'}
        />
      </div>
    </div>
  );
}

/**
 * 원가 비율 확대 모달 — 왼쪽은 항상 전사평균 고정, 오른쪽은 팀/파트 보기 전환 + 비교용 미니 도넛.
 * "팀" 선택 시 팀별로(소속 파트 합계), "파트" 선택 시 파트별로 미니 도넛이 나열된다.
 * 미니 카드는 이 그리드 안에서만 드래그로 순서 변경 가능(localStorage 저장, 팀/파트 모드 각각 별도),
 * 카드 우측상단 "⤢" 버튼을 누르면 그 카드를 확대해서 전사평균과 나란히 비교할 수 있다.
 */
const CostBreakdownModal = ({ total, byPart, partsRaw, teams, teamParts, colors, showLabels, onSliceClick }: Props) => {
  const [rightMode, setRightMode] = useState<'team' | 'part'>('part');
  const [order, setOrder] = useState<Record<'team' | 'part', string[]>>({
    team: loadOrder('cost-mini-order-team'),
    part: loadOrder('cost-mini-order-part'),
  });
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  const dndSensors = useTableDndSensors();

  const teamData = (team: string): CostData => {
    const allowed = new Set(teamParts[team] ?? []);
    const sums = [0, 0, 0, 0, 0];
    partsRaw.forEach(p => {
      if (allowed.has(p)) byPart[p]?.values.forEach((v, i) => { sums[i] += v; });
    });
    return { labels: COST_LABELS, values: sums };
  };

  const baseCells: Cell[] = rightMode === 'team'
    ? teams.map(t => ({ key: t, label: t, data: teamData(t) }))
    : partsRaw.filter(p => byPart[p]).map(p => ({ key: p, label: stripPartPrefix(p), data: byPart[p] }));

  // 저장된 순서 적용 — 저장값에 없는 새 항목은 뒤에 추가, 사라진 항목은 자동 제외
  const cells = useMemo(() => {
    const savedOrder = order[rightMode];
    if (!savedOrder.length) return baseCells;
    const byKey = new Map(baseCells.map(c => [c.key, c]));
    const ordered = savedOrder.filter(k => byKey.has(k)).map(k => byKey.get(k)!);
    const missing = baseCells.filter(c => !savedOrder.includes(c.key));
    return [...ordered, ...missing];
  }, [baseCells, order, rightMode]);

  const gridColsClass = cells.length > 3 ? styles.cols4 : styles.cols3;

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = cells.map(c => c.key);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setOrder(prev => {
      const merged = { ...prev, [rightMode]: next };
      localStorage.setItem(`cost-mini-order-${rightMode}`, JSON.stringify(next));
      return merged;
    });
  }, [cells, rightMode]);

  const previewCell = previewKey ? cells.find(c => c.key === previewKey) : null;

  return (
    <div className={styles.wrap}>
      {/* 왼쪽 — 항상 전사평균 고정. 조각 클릭 → 산출근거 표 모달 */}
      <div className={styles.left}>
        <span className={styles.sectionTitle}>전사평균</span>
        <div className={styles.bigChart}>
          <BigCostDoughnut
            labels={total.labels}
            data={total.values}
            colors={colors}
            showLabels={showLabels}
            onSliceClick={onSliceClick}
          />
        </div>
      </div>

      {/* 오른쪽 — 팀/파트 보기 전환 + 비교용 미니 도넛 (드래그 정렬 + 호버 확대) */}
      <div className={styles.right}>
        <div className={styles.modeTabs}>
          <Button
            unstyled
            className={`${styles.modeTab} ${rightMode === 'team' ? styles.modeTabActive : ''}`}
            onClick={() => setRightMode('team')}
          >
            팀
          </Button>
          <Button
            unstyled
            className={`${styles.modeTab} ${rightMode === 'part' ? styles.modeTabActive : ''}`}
            onClick={() => setRightMode('part')}
          >
            파트
          </Button>
        </div>

        {previewCell ? (
          // "⤢" 버튼으로 확대한 카드를 전사평균과 비슷한 크기로 — 그리드 자리를 그대로 대체
          <div className={styles.previewWrap}>
            <div className={styles.previewHeader}>
              <span className={styles.sectionTitle}>{previewCell.label}</span>
              <Button unstyled className={styles.previewCloseBtn} onClick={() => setPreviewKey(null)} aria-label="목록으로">
                ✕ 목록으로
              </Button>
            </div>
            <div className={styles.bigChart}>
              <DoughnutChart
                labels={previewCell.data.labels}
                data={previewCell.data.values}
                colors={colors}
                showLabels={showLabels}
                outsideLabels
                outsideLabelsSize="lg"
              />
            </div>
          </div>
        ) : (
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={cells.map(c => c.key)} strategy={rectSortingStrategy}>
              <div className={`${styles.partGrid} ${gridColsClass}`}>
                {cells.map(cell => (
                  <SortableCard
                    key={cell.key}
                    cell={cell}
                    colors={colors}
                    showLabels={showLabels}
                    cols4={cells.length > 3}
                    onExpand={setPreviewKey}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
};

export default CostBreakdownModal;
