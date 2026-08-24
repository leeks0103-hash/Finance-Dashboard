import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

/** 컬럼 DnD 공용 센서 — 5px 이상 움직여야 드래그 시작 (클릭과 구분) */
export const useTableDndSensors = () =>
  useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
