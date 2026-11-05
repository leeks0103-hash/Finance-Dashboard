import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { NotificationViewModel } from '@/hooks/viewmodels/useNotificationViewModel';

let vm: NotificationViewModel;
vi.mock('@/hooks/viewmodels/useNotificationViewModel', () => ({ useNotificationViewModel: () => vm }));
import NotificationBell from './NotificationBell';

const clear: NotificationViewModel = { total: 0, badgeText: '', groups: [], checkedAt: '2026-11-06 08:00', checkFailed: false, enabled: true, scheduleText: '매일 오전 8시에 확인' };
const alert: NotificationViewModel = {
  total: 7, badgeText: '7', checkedAt: '2026-11-06 08:00', checkFailed: false, enabled: true, scheduleText: '매일 오전 8시에 확인',
  groups: [{ key: 'finance', label: '재무', items: [{ label: '열기 실패', count: 7 }] }],
};

describe('NotificationBell', () => {
  beforeEach(() => { vm = clear; });

  it('0건이면 종은 있고 배지는 없음', () => {
    render(<NotificationBell onOpenAlerts={() => {}} />);
    const btn = screen.getByRole('button', { name: '알림 없음' });
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('');
  });

  it('0이 아니면 합계 배지가 뜸', () => {
    vm = alert;
    render(<NotificationBell onOpenAlerts={() => {}} />);
    expect(screen.getByRole('button', { name: '알림 7건' }).textContent).toBe('7');
  });

  it('누르면 항목별 건수와 마지막 확인 시각, [추출 현황 열기]가 보임', () => {
    vm = alert;
    const onOpen = vi.fn();
    render(<NotificationBell onOpenAlerts={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: '알림 7건' }));
    expect(screen.getByText('재무')).toBeTruthy();
    expect(screen.getByText(/열기 실패/).textContent).toContain('7');
    expect(screen.getByText(/마지막 확인 2026-11-06 08:00/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '알림 설정·현황 열기' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('0건일 때는 열기 버튼 없이 안내만(2026-11-05) — 0건일 때 열면 "확인이 필요한 파일이 없습니다"', () => {
    render(<NotificationBell onOpenAlerts={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '알림 없음' }));
    expect(screen.getByText('확인이 필요한 파일이 없습니다')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '알림 설정·현황 열기' })).toBeNull();
  });

  it('설정한 시각·빈도 문구가 마지막 확인 옆에 보임', () => {
    vm = { ...alert, scheduleText: '평일 오후 3시에 확인' };
    render(<NotificationBell onOpenAlerts={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '알림 7건' }));
    expect(screen.getByText(/평일 오후 3시에 확인/)).toBeTruthy();
  });

  it('확인이 꺼져 있으면 배지 없이 꺼짐 안내', () => {
    vm = { ...clear, enabled: false, scheduleText: '확인 꺼짐' };
    render(<NotificationBell onOpenAlerts={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '알림 없음' }));
    expect(screen.getByText('알림 확인이 꺼져 있습니다')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '알림 설정·현황 열기' })).toBeNull();
  });

  it('원본 폴더 접근 실패면 안내 문구', () => {
    vm = { ...alert, checkFailed: true };
    render(<NotificationBell onOpenAlerts={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '알림 7건' }));
    expect(screen.getByText(/접근 실패/)).toBeTruthy();
  });
});
