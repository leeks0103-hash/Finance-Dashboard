import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

/** 드래그로 인식하기 전 최소 이동 거리 — 이보다 짧으면 클릭으로 간주 */
const DRAG_ACTIVATION_DISTANCE_PX = 5;

/** DnD 정렬 공용 센서 — 테이블 컬럼뿐 아니라 카드 순서 변경(ChartSection) 등 드래그 정렬 전반에 재사용 */
export const useTableDndSensors = () =>
  useSensors(useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX } }));
