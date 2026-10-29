import { useState, useCallback } from 'react';
import {
  DndContext, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { KpiCard, useTableDndSensors } from '@/components/ui';
import PerfCompareCard from './PerfCompareCard';
import type { PerfKpiCard } from '@/hooks/viewmodels/usePerformanceViewModel';
import { SORTABLE_TRANSITION, sortableItemStyle } from '@/components/ui/sortableMotion';
import styles from './PerformanceKpiSection.module.css';

// usePerformanceViewModel의 카드 id와 동일해야 함 — 매출 → 직접원가 → 공통원가 → 매출이익 → 인건비 → 관리비 → 경상손익 (전부 계획→추정 비교)
// ('junActual' 누계 실적 카드는 2026-10-23 주석 처리 — 수치는 진도율(월별 실적 추이) 옆으로 옮길 예정, 복구 시 여기 마지막에 추가)
const DEFAULT_KPI_ORDER = ['revenue', 'cost', 'overhead', 'grossProfit', 'labor', 'mgmt', 'profit'];
// v3 — 매출/원가 분리 + 계획→추정 비교 카드로 재편, 기존 저장값 무효화
const LS_KPI_ORDER = 'performance-kpi-order-v3';

interface Props {
  cards: PerfKpiCard[];
  /** 카드 순서를 저장하는 localStorage 키 — 기본은 실적 보기. 2027 계획 보기는 따로 저장(같은 카드 id라 안 나누면 서로 순서를 덮어씀, 2026-10-29) */
  orderKey?: string;
}

// 카드 전체가 아니라 그립 아이콘만 드래그 — 차트 섹션(ChartSection/PerformanceChartSection)과 동일 패턴,
// 위치만 사용자 지정으로 우측 상단
interface SortableCardProps { id: string; wide: boolean; children: React.ReactNode }
function SortableCard({ id, wide, children }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, transition: SORTABLE_TRANSITION });
  return (
    <div
      ref={setNodeRef}
      className={`${styles.sortable} ${wide ? styles.wide : styles.narrow}`}
      style={sortableItemStyle({ transform, transition, isDragging })}
    >
      <div className={styles.dragHandle} {...attributes} {...listeners} aria-label="카드 순서 이동" title="드래그하여 순서 변경">
        ⠿
      </div>
      {children}
    </div>
  );
}

const PerformanceKpiSection = ({ cards, orderKey = LS_KPI_ORDER }: Props) => {
  // order 자체가 항상 "화면에 쓸 완전한 순서"여야 drag가 실제로 반영됨 — 저장값이 없으면
  // 빈 배열이 아니라 DEFAULT_KPI_ORDER로 채워야 함 (PerformanceChartSection과 동일 패턴).
  // 이전 버전은 order를 빈 배열로 시작해두고 렌더 시에만 별도로 기본순서를 합성했는데,
  // handleDragEnd가 그 "합성 결과"가 아니라 원본 order([])에 arrayMove를 적용해 항상 무효화됐음
  // (드래그 중 애니메이션만 보이고 드롭 후 원위치로 돌아가던 버그의 원인)
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(orderKey) ?? '[]');
      const valid = saved.filter(id => DEFAULT_KPI_ORDER.includes(id));
      if (!valid.length) return DEFAULT_KPI_ORDER;
      // 새로 생긴 카드(관리비 등)는 맨 뒤가 아니라 기본 순서상 바로 앞 카드 뒤에 끼움 — 이미 순서를 저장한 브라우저도 같은 자리에
      const merged = [...valid];
      DEFAULT_KPI_ORDER.forEach((id, i) => {
        if (merged.includes(id)) return;
        const prev = i > 0 ? merged.indexOf(DEFAULT_KPI_ORDER[i - 1]) : -1;
        merged.splice(prev + 1, 0, id);
      });
      return merged;
    } catch { return DEFAULT_KPI_ORDER; }
  });

  const dndSensors = useTableDndSensors();

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder(prev => {
      const next = arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id)));
      localStorage.setItem(orderKey, JSON.stringify(next));
      return next;
    });
  }, [orderKey]);

  // cards가 아직 로딩 중이라 일부 id만 와 있어도 order 기준으로 정렬 후 없는 건 걸러냄.
  // SortableContext의 items는 실제로 렌더되는 카드 id와 정확히 같아야 함 — order 그대로 넘기면
  // 로딩 중(cards=[])일 때 렌더된 카드 0개인데 items만 4개라 dnd-kit 내부 상태가 어긋남
  const byId = new Map(cards.map(c => [c.id, c]));
  const sortedCards = order.map(id => byId.get(id)).filter((c): c is PerfKpiCard => !!c);

  // 아직 카드가 없을 때(첫 로딩) 빈 영역 대신 카드 자리 스켈레톤 — 도착할 때 아래 내용이 튀지 않음(2026-10-28)
  if (sortedCards.length === 0) {
    return (
      <div className={styles.kpiGrid} aria-busy="true" aria-label="카드 불러오는 중">
        {DEFAULT_KPI_ORDER.map(id => <div key={id} className={`${styles.wide} ${styles.skeleton}`} />)}
      </div>
    );
  }

  return (
    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortedCards.map(c => c.id)} strategy={rectSortingStrategy}>
        <div className={`${styles.kpiGrid} ${styles.arrive}`}>
          {sortedCards.map(card => (
            // 폭은 카드 종류(kind) 기준 — 드래그로 자리를 옮겨도 이 카드는 항상 같은 폭 유지
            <SortableCard key={card.id} id={card.id} wide={card.kind === 'compare'}>
              {card.kind === 'compare' ? (
                <PerfCompareCard card={card} />
              ) : (
                <KpiCard
                  label={card.label}
                  value={card.value}
                  accent={card.accent}
                  sub={card.sub}
                  valueNote={card.valueNote}
                  trendUp={card.trendUp}
                  trend={card.trend}
                  className="perf-kpi-card"
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
