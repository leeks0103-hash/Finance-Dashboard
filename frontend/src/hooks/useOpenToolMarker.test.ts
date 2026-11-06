import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/utils/dialog', () => ({ toast: vi.fn() }));

import { useOpenToolMarker } from './useOpenToolMarker';
import { useUiStore } from '@/store';
import { toast } from '@/utils/dialog';

describe('useOpenToolMarker (2026-11-06 — 설치가 끝났다는 표시를 이 브라우저에 남김)', () => {
  beforeEach(() => {
    useUiStore.setState({ openToolInstalled: false });
    vi.mocked(toast).mockClear();
    window.history.replaceState(null, '', '/#/performance');
  });

  it('?opentool=1이면 설치됨으로 표시하고 주소에서 표시만 지운다(해시 라우트는 그대로)', () => {
    window.history.replaceState(null, '', '/?opentool=1&keep=1#/performance');
    renderHook(() => useOpenToolMarker());
    expect(useUiStore.getState().openToolInstalled).toBe(true);
    expect(window.location.search).toBe('?keep=1');
    expect(window.location.hash).toBe('#/performance');
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('표시가 하나뿐이면 물음표까지 지운다', () => {
    window.history.replaceState(null, '', '/?opentool=1#/performance');
    renderHook(() => useOpenToolMarker());
    expect(window.location.search).toBe('');
  });

  it('표시가 없으면 아무것도 바꾸지 않는다', () => {
    renderHook(() => useOpenToolMarker());
    expect(useUiStore.getState().openToolInstalled).toBe(false);
    expect(toast).not.toHaveBeenCalled();
  });

  it('opentool=1이 아닌 값은 무시한다', () => {
    window.history.replaceState(null, '', '/?opentool=0#/performance');
    renderHook(() => useOpenToolMarker());
    expect(useUiStore.getState().openToolInstalled).toBe(false);
  });
});
