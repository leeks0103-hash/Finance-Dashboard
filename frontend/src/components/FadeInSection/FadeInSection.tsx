import { useState, type ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface Props {
  /** fadeUp 애니메이션 지연(ms). 섹션 순서대로 0, 100, 150… */
  delay?:    number;
  /** 사용법 투어(ProductTour)가 이 섹션을 가리킬 때 쓰는 앵커 — `data-tour` 속성으로 붙음 */
  tourId?:   string;
  /** 데이터 재조회 중이면 true — 섹션이 살짝 흐려졌다 돌아옴(index.css .refreshing). 이전 데이터는 그대로 보임 */
  refreshing?: boolean;
  children:  ReactNode;
}

/**
 * 페이지 섹션 래퍼 — `fadeUp` 진입 애니메이션 + ErrorBoundary.
 * 세 페이지(Finance·Kpi·Performance)에서 반복되던
 * `<div className="fadeUp" style={{ animationDelay }}><ErrorBoundary>…` 패턴을 하나로.
 *
 * fadeUp은 **처음 한 번만**(2026-10-28) — 탭이 display:none에서 돌아올 때마다 CSS 애니메이션이 다시 재생돼
 * 탭 전체의 tabFadeIn과 겹쳐 두 번 움직이던 것을 막음. 끝나면 클래스를 떼어 transform도 남지 않음(fixed 요소 기준이 어긋나는 걸 방지).
 */
export const FadeInSection = ({ delay = 0, tourId, refreshing = false, children }: Props) => {
  const [entered, setEntered] = useState(false);
  return (
    <div
      className={`${entered ? '' : 'fadeUp'} refreshable${refreshing ? ' refreshing' : ''}`.trim()}
      style={entered ? undefined : { animationDelay: `${delay}ms` }}
      data-tour={tourId}
      onAnimationEnd={e => { if (e.target === e.currentTarget && !entered) setEntered(true); }}
    >
      <ErrorBoundary>{children}</ErrorBoundary>
    </div>
  );
};

export default FadeInSection;
