import { useState, useCallback } from 'react';
import {
  DndContext, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { KpiCard, useTableDndSensors } from '@/components/ui';
import PerfCompareCard from './PerfCompareCard';
import type { PerfKpiCard } from '@/hooks/viewmodels/usePerformanceViewModel';
import styles from './PerformanceKpiSection.module.css';

// usePerformanceViewModel의 카드 id와 동일해야 함 — 매출 → 원가 → 매출이익 (계획→추정 비교) → 경상손익 → 누계 실적
const DEFAULT_KPI_ORDER = ['revenue', 'cost', 'grossProfit', 'profit', 'junActual'];
// v3 — 매출/원가 분리 + 계획→추정 비교 카드로 재편, 기존 저장값 무효화
const LS_KPI_ORDER = 'performance-kpi-order-v3';

interface Props {
  cards: PerfKpiCard[];
}

// 카드 전체가 아니라 그립 아이콘만 드래그 — 차트 섹션(ChartSection/PerformanceChartSection)과 동일 패턴,
// 위치만 사용자 지정으로 우측 상단
interface SortableCardProps { id: string; narrow?: boolean; children: React.ReactNode }
function SortableCard({ id, narrow, children }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${styles.sortable} ${narrow ? styles.sortableNarrow : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <div className={styles.dragHandle} {...attributes} {...listeners} aria-label="카드 순서 이동" title="드래그하여 순서 변경">
        ⠿
      </div>
      {children}
    </div>
  );
}

const PerformanceKpiSection = ({ cards }: Props) => {
  // order 자체가 항상 "화면에 쓸 완전한 순서"여야 drag가 실제로 반영됨 — 저장값이 없으면
  // 빈 배열이 아니라 DEFAULT_KPI_ORDER로 채워야 함 (PerformanceChartSection과 동일 패턴).
  // 이전 버전은 order를 빈 배열로 시작해두고 렌더 시에만 별도로 기본순서를 합성했는데,
  // handleDragEnd가 그 "합성 결과"가 아니라 원본 order([])에 arrayMove를 적용해 항상 무효화됐음
  // (드래그 중 애니메이션만 보이고 드롭 후 원위치로 돌아가던 버그의 원인)
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(LS_KPI_ORDER) ?? '[]');
      const valid = saved.filter(id => DEFAULT_KPI_ORDER.includes(id));
      const added = DEFAULT_KPI_ORDER.filter(id => !valid.includes(id));
      return valid.length ? [...valid, ...added] : DEFAULT_KPI_ORDER;
    } catch { return DEFAULT_KPI_ORDER; }
  });

  const dndSensors = useTableDndSensors();

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder(prev => {
      const next = arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id)));
      localStorage.setItem(LS_KPI_ORDER, JSON.stringify(next));
      return next;
    });
  }, []);

  // cards가 아직 로딩 중이라 일부 id만 와 있어도 order 기준으로 정렬 후 없는 건 걸러냄.
  // SortableContext의 items는 실제로 렌더되는 카드 id와 정확히 같아야 함 — order 그대로 넘기면
  // 로딩 중(cards=[])일 때 렌더된 카드 0개인데 items만 4개라 dnd-kit 내부 상태가 어긋남
  const byId = new Map(cards.map(c => [c.id, c]));
  const sortedCards = order.map(id => byId.get(id)).filter((c): c is PerfKpiCard => !!c);

  return (
    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortedCards.map(c => c.id)} strategy={rectSortingStrategy}>
        <div className={styles.kpiGrid}>
          {sortedCards.map(card => (
            // 경상손익·누계 실적(단일값 카드)만 폭을 살짝 줄임 — 비교 카드보다 내용이 단순해서
            <SortableCard key={card.id} id={card.id} narrow={card.kind === 'single'}>
              {card.kind === 'compare' ? (
                <PerfCompareCard card={card} />
              ) : (
                <KpiCard
                  label={card.label}
                  value={card.value}
                  accent={card.accent}
                  sub={card.sub}
                  trendUp={card.trendUp}
                  trend={card.trend}
                />
              )}
            </SortableCard>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default PerformanceKpiSection;
