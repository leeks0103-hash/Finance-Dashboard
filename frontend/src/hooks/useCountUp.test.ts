import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountUp } from './useCountUp';

describe('useCountUp (2026-10-28 — 이전 값에서 새 값으로)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); delete (window as { matchMedia?: unknown }).matchMedia; });

  const run = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

  it('첫 렌더는 0에서 시작해 목표 값에서 정확히 끝난다', () => {
    const { result } = renderHook(({ t }) => useCountUp(t, 400), { initialProps: { t: 100 } });
    expect(result.current).toBe(0);
    run(200);
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(100);
    run(400);
    expect(result.current).toBe(100);
  });

  it('값이 바뀌면 0이 아니라 지금 값에서 새 값으로 이어 간다', () => {
    const { result, rerender } = renderHook(({ t }) => useCountUp(t, 400), { initialProps: { t: 100 } });
    run(1000);
    expect(result.current).toBe(100);
    rerender({ t: 120 });
    run(100);
    // 100과 120 사이여야 함 — 예전엔 0으로 떨어졌다가 올라와 100 미만이 나왔음
    expect(result.current).toBeGreaterThanOrEqual(100);
    expect(result.current).toBeLessThan(120);
    run(1000);
    expect(result.current).toBe(120);
  });

  it('목표가 0으로 바뀌어도 스냅하지 않고 내려간다', () => {
    const { result, rerender } = renderHook(({ t }) => useCountUp(t, 400), { initialProps: { t: 50 } });
    run(1000);
    rerender({ t: 0 });
    run(100);
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(50);
    run(1000);
    expect(result.current).toBe(0);
  });

  it('"움직임 줄이기"가 켜져 있으면 즉시 목표 값', () => {
    // jsdom엔 matchMedia가 없어 직접 심음
    Object.defineProperty(window, 'matchMedia', {
      configurable: true, writable: true,
      value: (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }),
    });
    const { result } = renderHook(() => useCountUp(77, 400));
    expect(result.current).toBe(77);
  });

  it('숫자가 아닌 값(NaN)은 0', () => {
    const { result } = renderHook(() => useCountUp(Number.NaN, 400));
    expect(result.current).toBe(0);
  });
});
