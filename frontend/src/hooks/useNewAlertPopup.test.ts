import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const confirmDialog = vi.fn();
const isDialogOpen = vi.fn();
vi.mock('@/utils/dialog', () => ({
  confirmDialog: (...a: unknown[]) => confirmDialog(...a),
  isDialogOpen: () => isDialogOpen(),
}));
import { useNewAlertPopup } from './useNewAlertPopup';

const markSeen = vi.fn();
const onOpen = vi.fn();
const src = (over: Partial<Parameters<typeof useNewAlertPopup>[0]> = {}) => ({
  unread: true, total: 7, summaryLines: ['재무 — 열기 실패 7'], markSeen, ...over,
});
/** 비동기 확인창 결과까지 흘려보냄 */
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  vi.useFakeTimers();
  confirmDialog.mockReset().mockResolvedValue(false);
  isDialogOpen.mockReset().mockReturnValue(false);
  markSeen.mockReset();
  onOpen.mockReset();
});
afterEach(() => { vi.useRealTimers(); });

describe('useNewAlertPopup — 새 알림이 있으면 봉투 아이콘 팝업, 0건이면 안 뜸', () => {
  it('새 알림이 있으면 메일 아이콘 팝업(건수·항목 요약)이 한 번 뜬다', async () => {
    renderHook(() => useNewAlertPopup(src(), onOpen));
    await flush();
    expect(confirmDialog).toHaveBeenCalledTimes(1);
    const [text, opts] = confirmDialog.mock.calls[0] as [string, { icon: string; title: string; confirmText: string; cancelText: string }];
    expect(text).toContain('확인이 필요한 파일 7건');
    expect(text).toContain('재무 — 열기 실패 7');
    expect(opts).toMatchObject({ icon: 'mail', title: '새 알림이 도착했습니다', confirmText: '추출 현황 열기', cancelText: '나중에' });
  });

  it('0건(새 알림 없음)이면 팝업도 없다', async () => {
    renderHook(() => useNewAlertPopup(src({ unread: false, total: 0, summaryLines: [] }), onOpen));
    await flush();
    expect(confirmDialog).not.toHaveBeenCalled();
  });

  it('[추출 현황 열기]를 누르면 확인 처리(점 꺼짐) + 추출 현황 열기', async () => {
    confirmDialog.mockResolvedValue(true);
    renderHook(() => useNewAlertPopup(src(), onOpen));
    await flush();
    expect(markSeen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('[나중에]면 확인 처리를 안 한다 — 빨간 점은 그대로(종을 열 때 꺼짐)', async () => {
    renderHook(() => useNewAlertPopup(src(), onOpen));
    await flush();
    expect(markSeen).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('같은 알림으로는 다시 받아도(5분 주기 재조회) 반복해서 안 뜬다, 건수가 달라지면 다시 뜬다', async () => {
    const { rerender } = renderHook(({ s }) => useNewAlertPopup(s, onOpen), { initialProps: { s: src() } });
    await flush();
    rerender({ s: src() });                                        // 같은 내용으로 새 객체
    await flush();
    expect(confirmDialog).toHaveBeenCalledTimes(1);

    rerender({ s: src({ total: 9, summaryLines: ['재무 — 열기 실패 7', 'KPI — 열기 실패 2'] }) });
    await flush();
    expect(confirmDialog).toHaveBeenCalledTimes(2);
  });

  it('다른 확인·알림 창이 열려 있으면 그 창을 덮지 않고 닫힐 때까지 기다렸다 띄운다', async () => {
    isDialogOpen.mockReturnValue(true);
    renderHook(() => useNewAlertPopup(src(), onOpen));
    await flush();
    expect(confirmDialog).not.toHaveBeenCalled();

    isDialogOpen.mockReturnValue(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(3100); });
    expect(confirmDialog).toHaveBeenCalledTimes(1);
  });

  it('팝업을 기다리는 중에 확인(점 꺼짐)이 되면 띄우지 않는다', async () => {
    isDialogOpen.mockReturnValue(true);
    const { rerender } = renderHook(({ s }) => useNewAlertPopup(s, onOpen), { initialProps: { s: src() } });
    await flush();
    rerender({ s: src({ unread: false }) });                       // 종을 열어 확인함
    isDialogOpen.mockReturnValue(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(confirmDialog).not.toHaveBeenCalled();
  });
});
