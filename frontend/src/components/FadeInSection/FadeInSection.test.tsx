import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { FadeInSection } from './FadeInSection';

// jsdom의 style에는 animation 속성이 없어 React가 애니메이션 이벤트를 접두사 이름(webkitAnimationEnd)으로 듣는다 —
// 실제 브라우저에선 animationend. 테스트에선 두 이름을 다 쏴서 환경과 무관하게 같은 동작을 확인
const endAnimation = (el: Element) => {
  fireEvent(el, new Event('animationend', { bubbles: true }));
  fireEvent(el, new Event('webkitAnimationEnd', { bubbles: true }));
};

describe('FadeInSection (2026-10-28)', () => {
  it('처음엔 fadeUp이 붙고, 애니메이션이 끝나면 떼어 탭을 다시 열어도 재생되지 않는다', () => {
    const { container } = render(<FadeInSection tourId="t"><p>내용</p></FadeInSection>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains('fadeUp')).toBe(true);
    endAnimation(root);
    expect(root.classList.contains('fadeUp')).toBe(false);
    expect(root.style.animationDelay).toBe('');
  });

  it('자식에서 올라온 animationend로는 떼지 않는다', () => {
    const { container, getByText } = render(<FadeInSection><p>내용</p></FadeInSection>);
    endAnimation(getByText('내용'));
    expect((container.firstElementChild as HTMLElement).classList.contains('fadeUp')).toBe(true);
  });

  it('refreshing이면 .refreshing 클래스, 아니면 .refreshable만', () => {
    const { container, rerender } = render(<FadeInSection><p>x</p></FadeInSection>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.classList.contains('refreshable')).toBe(true);
    expect(root.classList.contains('refreshing')).toBe(false);
    rerender(<FadeInSection refreshing><p>x</p></FadeInSection>);
    expect(root.classList.contains('refreshing')).toBe(true);
  });
});
