import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getExtractStatus = vi.fn();
vi.mock('@/api/extract.api', () => ({
  runExtract: vi.fn(), cancelExtract: vi.fn(), loginAdmin: vi.fn(),
  getExtractStatus: () => getExtractStatus(),
  getStoredExtractName: () => '',
  setStoredExtractAuth: vi.fn(),
  clearStoredExtractAuth: vi.fn(),
}));

import { useExtractJob } from './useExtractJob';

const status = (over: object) => ({ running: false, targets: [], mode: null, started_by: null, started_at: null,
  finished_at: null, ok: null, message: '', cancelled: false, ...over });

const setup = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useExtractJob(), { wrapper });
  return { qc, spy, hook };
};

beforeEach(() => { getExtractStatus.mockReset(); });

describe('추출이 끝났을 때 캐시 무효화 (2026-11-06)', () => {
  it('실패·중지로 끝나도 알림 종은 새로 받는다(서버가 끝날 때 추출 현황을 다시 세므로) — 나머지 데이터는 그대로', async () => {
    getExtractStatus
      .mockResolvedValueOnce(status({ finished_at: '2026-11-06 10:00:00', ok: true }))     // 기준값
      .mockResolvedValue(status({ finished_at: '2026-11-06 11:00:00', ok: false }));       // 방금 실패로 끝남
    const { qc, spy, hook } = setup();
    await waitFor(() => expect(hook.result.current.status).toBeTruthy());
    expect(spy).not.toHaveBeenCalled();

    await qc.refetchQueries({ queryKey: ['extract-status'] });
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['notifications'] }));
    expect(spy).not.toHaveBeenCalledWith();   // 실패면 전부 무효화(옛 동작 아님)는 안 함
  });

  it('성공으로 끝나면 전부 무효화한다(알림 포함) — 기존 동작 그대로', async () => {
    getExtractStatus
      .mockResolvedValueOnce(status({ finished_at: '2026-11-06 10:00:00', ok: true }))
      .mockResolvedValue(status({ finished_at: '2026-11-06 11:00:00', ok: true }));
    const { qc, spy, hook } = setup();
    await waitFor(() => expect(hook.result.current.status).toBeTruthy());

    await qc.refetchQueries({ queryKey: ['extract-status'] });
    await waitFor(() => expect(spy).toHaveBeenCalledWith());
  });

  it('완료 시각이 안 바뀌었으면(첫 응답 포함) 아무것도 무효화하지 않는다', async () => {
    getExtractStatus.mockResolvedValue(status({ finished_at: '2026-11-06 10:00:00', ok: true }));
    const { qc, spy, hook } = setup();
    await waitFor(() => expect(hook.result.current.status).toBeTruthy());
    await qc.refetchQueries({ queryKey: ['extract-status'] });
    expect(spy).not.toHaveBeenCalled();
  });
});
