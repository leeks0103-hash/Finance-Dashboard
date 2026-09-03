import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColumnHighlight } from './useColumnHighlight';

describe('useColumnHighlight', () => {
  it('sets and clears highlight manually', () => {
    const { result } = renderHook(() => useColumnHighlight());

    act(() => result.current.setHighlight('col1'));
    expect(result.current.highlightedCol).toBe('col1');

    act(() => result.current.clearHighlight());
    expect(result.current.highlightedCol).toBeNull();
  });

  describe('with containerRef', () => {
    let container: HTMLDivElement;
    let inside: HTMLElement;
    let outside: HTMLElement;

    afterEach(() => {
      container.remove();
      outside.remove();
    });

    const setUp = () => {
      container = document.createElement('div');
      inside = document.createElement('span');
      container.appendChild(inside);
      document.body.appendChild(container);
      outside = document.createElement('div');
      document.body.appendChild(outside);
      return { current: container };
    };

    it('clears highlight on mousedown outside the container', () => {
      const ref = setUp();
      const { result } = renderHook(() => useColumnHighlight(ref));

      act(() => result.current.setHighlight('col1'));
      expect(result.current.highlightedCol).toBe('col1');

      act(() => {
        outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });
      expect(result.current.highlightedCol).toBeNull();
    });

    it('keeps highlight on mousedown inside the container', () => {
      const ref = setUp();
      const { result } = renderHook(() => useColumnHighlight(ref));

      act(() => result.current.setHighlight('col1'));

      act(() => {
        inside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      });
      expect(result.current.highlightedCol).toBe('col1');
    });
  });
});
