import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getVisibility = vi.fn();
vi.mock('@/api/settings.api', () => ({ getVisibility: () => getVisibility(), putVisibility: vi.fn() }));

import { useOpenToolViewModel } from './useOpenToolViewModel';
import { useUiStore } from '@/store';

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

const vis = (o: Partial<Record<string, string>>) =>
  ({ fileOpen: 'admin', folderOpen: 'admin', achieveRate: 'none', aiInsight: 'none', extractRequest: 'none', ...o });

describe('useOpenToolViewModel — 설치 메뉴 노출 (2026-11-06)', () => {
  beforeEach(() => {
    useUiStore.setState({ adminAuthed: false, openToolInstalled: false, openToolModalOpen: false });
    getVisibility.mockReset();
  });

  it('공개 범위 응답이 늦게 와도(관리자만 → 전체) 훅 순서가 깨지지 않고 메뉴가 나타난다', async () => {
    // 이번 장애의 재현: `useVisible('fileOpen') || useVisible('folderOpen')`처럼 훅을 `||`로 부르면
    // 처음(기본값 admin=false)엔 둘 다, 응답 뒤(전체=true)엔 하나만 불려 React가 오류를 냄
    getVisibility.mockResolvedValue(vis({ fileOpen: 'all', folderOpen: 'all' }));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useOpenToolViewModel(), { wrapper });
    expect(result.current.offered).toBe(false);
    await waitFor(() => expect(result.current.offered).toBe(true));
    expect(err.mock.calls.some(c => String(c[0]).includes('order of Hooks'))).toBe(false);
    err.mockRestore();
  });

  it('둘 중 하나만 열려 있어도 메뉴가 나온다(파일만 / 폴더만)', async () => {
    getVisibility.mockResolvedValue(vis({ folderOpen: 'all' }));
    const { result } = renderHook(() => useOpenToolViewModel(), { wrapper });
    await waitFor(() => expect(result.current.offered).toBe(true));
  });

  it('관리자만이면 일반 회원에겐 안 나오고, 관리자 인증된 브라우저엔 나온다', async () => {
    getVisibility.mockResolvedValue(vis({}));
    const a = renderHook(() => useOpenToolViewModel(), { wrapper });
    await waitFor(() => expect(getVisibility).toHaveBeenCalled());
    expect(a.result.current.offered).toBe(false);

    useUiStore.setState({ adminAuthed: true });
    const b = renderHook(() => useOpenToolViewModel(), { wrapper });
    await waitFor(() => expect(b.result.current.offered).toBe(true));
  });

  it('설치 표시는 켜고 끌 수 있다', () => {
    getVisibility.mockResolvedValue(vis({}));
    const { result } = renderHook(() => useOpenToolViewModel(), { wrapper });
    result.current.markInstalled();
    expect(useUiStore.getState().openToolInstalled).toBe(true);
    result.current.clearInstalled();
    expect(useUiStore.getState().openToolInstalled).toBe(false);
  });
});
