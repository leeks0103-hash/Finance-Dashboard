import { describe, it, expect, vi, afterEach } from 'vitest';
import { useThemeStore } from './theme.store';

describe('theme.store 전환 클래스 (2026-10-28)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('전환 직후 <html>에 theme-switching이 붙었다가 잠시 뒤 떨어지고, data-theme은 바로 바뀐다', () => {
    vi.useFakeTimers();
    const root = document.documentElement;
    const before = useThemeStore.getState().theme;
    useThemeStore.getState().toggle();
    expect(root.getAttribute('data-theme')).not.toBe(before);
    expect(root.classList.contains('theme-switching')).toBe(true);
    vi.advanceTimersByTime(600);
    expect(root.classList.contains('theme-switching')).toBe(false);
    useThemeStore.getState().toggle();   // 원래대로
    vi.advanceTimersByTime(600);
  });
});
