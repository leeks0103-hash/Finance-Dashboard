import type { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface Props {
  /** fadeUp 애니메이션 지연(ms). 섹션 순서대로 0, 100, 150… */
  delay?:    number;
  /** 사용법 투어(ProductTour)가 이 섹션을 가리킬 때 쓰는 앵커 — `data-tour` 속성으로 붙음 */
  tourId?:   string;
  children:  ReactNode;
}

/**
 * 페이지 섹션 래퍼 — `fadeUp` 진입 애니메이션 + ErrorBoundary.
 * 세 페이지(Finance·Kpi·Performance)에서 반복되던
 * `<div className="fadeUp" style={{ animationDelay }}><ErrorBoundary>…` 패턴을 하나로.
 */
export const FadeInSection = ({ delay = 0, tourId, children }: Props) => (
  <div className="fadeUp" style={{ animationDelay: `${delay}ms` }} data-tour={tourId}>
    <ErrorBoundary>{children}</ErrorBoundary>
  </div>
);

export default FadeInSection;
