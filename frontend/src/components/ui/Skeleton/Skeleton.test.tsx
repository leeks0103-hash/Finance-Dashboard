import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Skeleton from './Skeleton';

describe('Skeleton', () => {
  it('모양 클래스·스타일을 받고 스크린리더에선 숨긴다', () => {
    const { container } = render(<Skeleton className="shape" style={{ width: 40 }} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('shape');
    expect(el.style.width).toBe('40px');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });
});
