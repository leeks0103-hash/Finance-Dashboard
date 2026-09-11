import type { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface Props {
  /** fadeUp 애니메이션 지연(ms). 섹션 순서대로 0, 100, 150… */
  delay?:    number;
  children:  ReactNode;
}

/**
 * 페이지 섹션 래퍼 — `fadeUp` 진입 애니메이션 + ErrorBoundary.
 * 세 페이지(Finance·Kpi·Performance)에서 반복되던
 * `<div className="fadeUp" style={{ animationDelay }}><ErrorBoundary>…` 패턴을 하나로.
 */
export const FadeInSection = ({ delay = 0, children }: Props) => (
  <div className="fadeUp" style={{ animationDelay: `${delay}ms` }}>
    <ErrorBoundary>{children}</ErrorBoundary>
  </div>
);

export default FadeInSection;
