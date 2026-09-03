import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTableEscapePriority } from './useTableEscapePriority';

const pressEscape = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
const pressOtherKey = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

describe('useTableEscapePriority', () => {
  it('ignores non-Escape keys', () => {
    const run = vi.fn();
    renderHook(() => useTableEscapePriority([{ active: true, run }]));

    pressOtherKey();
    expect(run).not.toHaveBeenCalled();
  });

  it('runs the first active handler on Escape and skips the rest', () => {
    const run1 = vi.fn();
    const run2 = vi.fn();
    renderHook(() => useTableEscapePriority([
      { active: false, run: run1 },
      { active: true, run: run2 },
    ]));

    pressEscape();
    expect(run1).not.toHaveBeenCalled();
    expect(run2).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no handler is active', () => {
    const run = vi.fn();
    renderHook(() => useTableEscapePriority([{ active: false, run }]));

    pressEscape();
    expect(run).not.toHaveBeenCalled();
  });

  it('always reads the latest handlers passed on re-render', () => {
    const runStale = vi.fn();
    const runFresh = vi.fn();
    const { rerender } = renderHook(
      ({ active }) => useTableEscapePriority([{ active, run: active ? runFresh : runStale }]),
      { initialProps: { active: false } },
    );

    rerender({ active: true });
    pressEscape();

    expect(runStale).not.toHaveBeenCalled();
    expect(runFresh).toHaveBeenCalledTimes(1);
  });
});
