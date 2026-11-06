import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { NotificationViewModel } from '@/hooks/viewmodels/useNotificationViewModel';

let vm: NotificationViewModel;
vi.mock('@/hooks/viewmodels/useNotificationViewModel', () => ({ useNotificationViewModel: () => vm }));
// 팝업은 useNewAlertPopup.test.ts에서 따로 — 여기선 종·드롭다운만
const popup = vi.fn();
vi.mock('@/hooks/useNewAlertPopup', () => ({ useNewAlertPopup: (...a: unknown[]) => popup(...a) }));
import NotificationBell from './NotificationBell';

const markSeen = vi.fn();
const clear: NotificationViewModel = {
  total: 0, unread: false, groups: [], summaryLines: [], checkedAt: '2026-11-06 08:00', checkFailed: false, enabled: true,
  scheduleText: '매일 오전 8시에 확인', markSeen,
};
const alert: NotificationViewModel = {
  total: 7, unread: true, checkedAt: '2026-11-06 08:00', checkFailed: false, enabled: true, scheduleText: '매일 오전 8시에 확인', markSeen,
  groups: [{ key: 'finance', label: '재무', items: [{ label: '열기 실패', count: 7 }] }],
  summaryLines: ['재무 — 열기 실패 7'],
};
const seenAlert: NotificationViewModel = { ...alert, unread: false };

const renderBell = (over: Partial<{ onOpenData: () => void; onOpenSettings: () => void }> = {}) =>
  render(<NotificationBell onOpenData={() => {}} onOpenSettings={() => {}} {...over} />);

describe('NotificationBell — 메일함처럼 빨간 점, 확인하면 꺼짐', () => {
  beforeEach(() => { vm = clear; markSeen.mockClear(); popup.mockClear(); });

  it('0건이면 종만 있고 점도 숫자도 없음', () => {
    renderBell();
    const btn = screen.getByRole('button', { name: '알림' });
    expect(btn.textContent).toBe('');
    expect(btn.querySelector('span')).toBeNull();
  });

  it('새 알림이 있으면 숫자 없는 빨간 점만 뜸(예전 합계 숫자 배지 없음)', () => {
    vm = alert;
    renderBell();
    const btn = screen.getByRole('button', { name: '새 알림이 있습니다' });
    expect(btn.textContent).toBe('');             // 숫자 글자 없음
    expect(btn.querySelector('span')).not.toBeNull();   // 점
  });

  it('종을 열면 확인한 것으로 기록하고(점이 꺼지도록) 항목별 건수·마지막 확인이 보임', () => {
    vm = alert;
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: '새 알림이 있습니다' }));
    expect(markSeen).toHaveBeenCalledTimes(1);
    expect(screen.getByText('재무')).toBeTruthy();
    expect(screen.getByText(/열기 실패/).textContent).toContain('7');
    expect(screen.getByText(/마지막 확인 2026-11-06 08:00/)).toBeTruthy();
  });

  it('이미 확인한 알림(숫자는 남아 있음)은 점이 없고, 열면 목록은 그대로 보임', () => {
    vm = seenAlert;
    renderBell();
    const btn = screen.getByRole('button', { name: '알림' });
    expect(btn.querySelector('span')).toBeNull();
    fireEvent.click(btn);
    expect(screen.getByText('재무')).toBeTruthy();
  });

  it('닫을 때는 확인 처리를 다시 하지 않는다', () => {
    vm = alert;
    renderBell();
    const btn = screen.getByRole('button', { name: '새 알림이 있습니다' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(markSeen).toHaveBeenCalledTimes(1);
  });

  it('[추출 현황 열기]는 확인할 파일이 있을 때만, 누르면 데이터 탭 열기 콜백', () => {
    vm = alert;
    const onOpenData = vi.fn();
    renderBell({ onOpenData });
    fireEvent.click(screen.getByRole('button', { name: '새 알림이 있습니다' }));
    fireEvent.click(screen.getByRole('button', { name: '추출 현황 열기' }));
    expect(onOpenData).toHaveBeenCalledTimes(1);
  });

  it('[알림 설정]은 항상 있고 누르면 알림 탭 열기 콜백 — 0건이면 [추출 현황 열기]는 없음', () => {
    const onOpenSettings = vi.fn();
    renderBell({ onOpenSettings });
    fireEvent.click(screen.getByRole('button', { name: '알림' }));
    expect(screen.getByText('확인이 필요한 파일이 없습니다')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '추출 현황 열기' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '알림 설정' }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('설정한 시각·빈도 문구가 마지막 확인 옆에 보임', () => {
    vm = { ...alert, scheduleText: '평일 오후 3시에 확인' };
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: '새 알림이 있습니다' }));
    expect(screen.getByText(/평일 오후 3시에 확인/)).toBeTruthy();
  });

  it('확인이 꺼져 있으면 점 없이 꺼짐 안내', () => {
    vm = { ...clear, enabled: false, scheduleText: '확인 꺼짐' };
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: '알림' }));
    expect(screen.getByText('알림 확인이 꺼져 있습니다')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '추출 현황 열기' })).toBeNull();
  });

  it('원본 폴더 접근 실패면 안내 문구', () => {
    vm = { ...alert, checkFailed: true };
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: '새 알림이 있습니다' }));
    expect(screen.getByText(/접근 실패/)).toBeTruthy();
  });

  it('새 알림 팝업 훅에 알림 상태와 [추출 현황 열기] 콜백을 넘김', () => {
    vm = alert;
    const onOpenData = vi.fn();
    renderBell({ onOpenData });
    expect(popup).toHaveBeenCalledWith(alert, onOpenData);
  });
});
