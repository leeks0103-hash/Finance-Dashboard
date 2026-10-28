import { useCountUp } from '@/hooks/useCountUp';
import type { PerfCompareCardData } from '@/hooks/viewmodels/usePerformanceViewModel';

/**
 * 계획/추정 비교 카드의 값 표시 — 값이 바뀔 때 지금 숫자에서 새 숫자로 부드럽게 이어 감(2026-10-28).
 * 계획 값이 없는 카드(`planStr` '-')는 그대로 '-'. 애니메이션이 끝난 프레임은 항상 VM이 만든 문자열(planStr/estStr) 그대로라
 * 표시 규칙(억 소수 첫째 자리)과 어긋나지 않음.
 */
export const useCompareCardViewModel = (card: PerfCompareCardData) => {
  const planV = useCountUp(card.planNum, 800);
  const estV  = useCountUp(card.estNum, 800);
  const fmt = (v: number) => `${v.toFixed(1)}억원`;
  return {
    planText: card.planStr === '-' ? '-' : (planV === card.planNum ? card.planStr : fmt(planV)),
    estText:  estV === card.estNum ? card.estStr : fmt(estV),
  };
};
