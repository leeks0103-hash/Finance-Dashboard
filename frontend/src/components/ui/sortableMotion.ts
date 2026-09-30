import type { CSSProperties } from 'react';
import { CSS, type Transform } from '@dnd-kit/utilities';

/** 카드 드래그 정렬(useSortable) 공용 움직임 — 밀려나는 카드가 기본(250ms ease)보다 느긋하게 미끄러지도록 */
export const SORTABLE_TRANSITION = { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };

/**
 * useSortable 결과로 카드 래퍼 style 만들기 — 잡은 카드는 살짝 떠오르고(확대·그림자), 놓으면 차분히 내려앉음.
 * 그림자는 box-shadow가 아니라 drop-shadow — 래퍼엔 배경이 없어 카드 모양(둥근 모서리)을 그대로 따라가게.
 */
export const sortableItemStyle = (
  { transform, transition, isDragging }: { transform: Transform | null; transition: string | undefined; isDragging: boolean },
): CSSProperties => ({
  transform: CSS.Transform.toString(transform),
  // dnd-kit transition은 transform 전용(잡고 있는 동안엔 비어 있음) — 떠오름 효과 전환은 따로 붙임
  transition: [transition, 'opacity 0.25s ease', 'scale 0.25s ease', 'filter 0.25s ease'].filter(Boolean).join(', '),
  opacity: isDragging ? 0.9 : 1,
  scale: isDragging ? '1.02' : '1',
  filter: isDragging ? 'drop-shadow(0 12px 24px rgba(0, 0, 0, 0.18))' : 'none',
  zIndex: isDragging ? 20 : undefined,
});
