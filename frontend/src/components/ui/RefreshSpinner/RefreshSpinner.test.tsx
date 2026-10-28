import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RefreshSpinner } from './index';

describe('RefreshSpinner (2026-10-28)', () => {
  it('active면 스피너(role=status)를 그리고, 아니면 아무것도 안 그린다', () => {
    const { container, rerender, queryByRole } = render(<RefreshSpinner active={false} />);
    expect(container.firstChild).toBeNull();
    rerender(<RefreshSpinner active />);
    expect(queryByRole('status')).not.toBeNull();
  });

  it('label을 접근성 이름으로 쓴다', () => {
    const { getByRole } = render(<RefreshSpinner active label="재무 데이터 불러오는 중…" />);
    expect(getByRole('status').getAttribute('aria-label')).toBe('재무 데이터 불러오는 중…');
  });
});
