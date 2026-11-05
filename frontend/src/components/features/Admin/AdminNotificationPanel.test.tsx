import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { NotificationSettings } from '@/api/notifications.api';

const update = vi.fn();
let settings: NotificationSettings | undefined;
let slots: string[] = ['08:00'];
let loadFailed = false;
let saveError: string | null = null;
const summary = {
  total: 7, badgeText: '7', checkedAt: '2026-11-06 08:00', checkFailed: false, enabled: true, scheduleText: '매일 오전 8시에 확인',
  groups: [{ key: 'finance' as const, label: '재무', items: [{ label: '열기 실패', count: 7 }] }],
};

vi.mock('@/hooks/viewmodels/useAdminNotificationViewModel', () => ({
  useAdminNotificationViewModel: () => ({
    summary, settings, slots, loadFailed, isLoading: false, nextCheck: '2026-11-07 08:00', saving: false, saveError, update,
  }),
}));
import AdminNotificationPanel from './AdminNotificationPanel';

const base: NotificationSettings = {
  enabled: true, days: [0, 1, 2, 3, 4, 5, 6], mode: 'times', times: ['08:00'],
  interval_minutes: 120, window_start: '08:00', window_end: '18:00',
};
const select = (label: string) => screen.getByLabelText(label) as HTMLSelectElement;

describe('AdminNotificationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settings = { ...base };
    slots = ['08:00'];
    loadFailed = false;
    saveError = null;
  });

  it('지금 알림 건수·다음 확인 시각을 보여 주고 [추출 현황 보기]가 데이터 탭으로 보냄', () => {
    const onGoData = vi.fn();
    render(<AdminNotificationPanel onGoData={onGoData} />);
    expect(document.querySelector('li')?.textContent).toContain('열기 실패 7');
    expect(screen.getByText('다음 확인 2026-11-07 08:00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '추출 현황 보기' }));
    expect(onGoData).toHaveBeenCalledTimes(1);
  });

  it('요일 선택 상자 — 평일·주말을 고르면 그 요일 목록 저장', () => {
    render(<AdminNotificationPanel onGoData={() => {}} />);
    fireEvent.change(select('확인할 요일'), { target: { value: 'weekdays' } });
    expect(update).toHaveBeenLastCalledWith({ days: [0, 1, 2, 3, 4] });
    fireEvent.change(select('확인할 요일'), { target: { value: 'weekend' } });
    expect(update).toHaveBeenLastCalledWith({ days: [5, 6] });
  });

  it('요일 직접 선택 — 요일 버튼이 나오고 누르면 그 요일만 켜고 끔(마지막 하나는 못 끔)', () => {
    settings = { ...base, days: [0, 2] };
    render(<AdminNotificationPanel onGoData={() => {}} />);
    expect(select('확인할 요일').value).toBe('custom');
    fireEvent.click(screen.getByRole('button', { name: '금' }));
    expect(update).toHaveBeenLastCalledWith({ days: [0, 2, 4] });
    fireEvent.click(screen.getByRole('button', { name: '월' }));
    expect(update).toHaveBeenLastCalledWith({ days: [2] });
  });

  it('요일이 하나만 남으면 그 요일은 끌 수 없음', () => {
    settings = { ...base, days: [3] };
    render(<AdminNotificationPanel onGoData={() => {}} />);
    update.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '목' }));
    expect(update).not.toHaveBeenCalled();
  });

  it('방식 선택 상자로 정해진 시각 ↔ 일정 간격 전환', () => {
    render(<AdminNotificationPanel onGoData={() => {}} />);
    fireEvent.change(select('확인 방식'), { target: { value: 'interval' } });
    expect(update).toHaveBeenLastCalledWith({ mode: 'interval' });
  });

  it('정해진 시각 — 입력 중엔 저장 안 하고 벗어날 때 저장, 여러 시각 추가·삭제', () => {
    settings = { ...base, times: ['08:00', '13:00'] };
    slots = ['08:00', '13:00'];
    render(<AdminNotificationPanel onGoData={() => {}} />);
    const first = screen.getByLabelText('확인 시각 1') as HTMLInputElement;
    fireEvent.change(first, { target: { value: '09:30' } });
    expect(update).not.toHaveBeenCalled();
    fireEvent.blur(first);
    expect(update).toHaveBeenLastCalledWith({ times: ['09:30', '13:00'] });

    fireEvent.click(screen.getByRole('button', { name: '+ 시각 추가' }));
    expect(update).toHaveBeenLastCalledWith({ times: ['08:00', '12:00', '13:00'] });     // 안 겹치는 첫 후보(12:00)

    fireEvent.click(screen.getByRole('button', { name: '확인 시각 2 지우기' }));
    expect(update).toHaveBeenLastCalledWith({ times: ['08:00'] });
  });

  it('시각이 하나뿐이면 지우기 버튼이 없음', () => {
    render(<AdminNotificationPanel onGoData={() => {}} />);
    expect(screen.queryByRole('button', { name: /지우기/ })).toBeNull();
  });

  it('시각이 6개면 추가 버튼이 없음', () => {
    settings = { ...base, times: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'] };
    slots = settings.times;
    render(<AdminNotificationPanel onGoData={() => {}} />);
    expect(screen.queryByRole('button', { name: '+ 시각 추가' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /지우기/ }).length).toBe(6);
  });

  it('일정 간격 — 간격 선택 상자·시간대 입력, 하루 확인 시각 목록 미리보기', () => {
    settings = { ...base, mode: 'interval' };
    slots = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
    render(<AdminNotificationPanel onGoData={() => {}} />);
    expect(screen.queryByLabelText('확인 시각 1')).toBeNull();
    fireEvent.change(select('확인 간격'), { target: { value: '240' } });
    expect(update).toHaveBeenLastCalledWith({ interval_minutes: 240 });
    expect(screen.getByText(/하루 6회/).textContent).toContain('08:00 · 10:00');
    const end = screen.getByLabelText('확인 시간대 끝') as HTMLInputElement;
    fireEvent.change(end, { target: { value: '20:00' } });
    fireEvent.blur(end);
    expect(update).toHaveBeenLastCalledWith({ window_start: '08:00', window_end: '20:00' });
  });

  it('시간대 시작이 끝보다 늦으면 저장하지 않음', () => {
    settings = { ...base, mode: 'interval' };
    render(<AdminNotificationPanel onGoData={() => {}} />);
    const start = screen.getByLabelText('확인 시간대 시작') as HTMLInputElement;
    fireEvent.change(start, { target: { value: '19:00' } });
    fireEvent.blur(start);
    expect(update).not.toHaveBeenCalled();
  });

  it('사용 토글을 끄면 저장', () => {
    render(<AdminNotificationPanel onGoData={() => {}} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(update).toHaveBeenLastCalledWith({ enabled: false });
  });

  it('꺼져 있으면 요일·방식 입력이 없음', () => {
    settings = { ...base, enabled: false };
    render(<AdminNotificationPanel onGoData={() => {}} />);
    expect(screen.queryByLabelText('확인 방식')).toBeNull();
    expect(screen.queryByLabelText('확인할 요일')).toBeNull();
  });

  it('서버가 거절한 이유(저장 오류)를 그대로 보여 줌', () => {
    saveError = '확인 시간대의 시작은 끝보다 빨라야 합니다';
    render(<AdminNotificationPanel onGoData={() => {}} />);
    expect(screen.getByText('확인 시간대의 시작은 끝보다 빨라야 합니다')).toBeTruthy();
  });

  it('설정을 못 불러오면 안내', () => {
    settings = undefined;
    loadFailed = true;
    render(<AdminNotificationPanel onGoData={() => {}} />);
    expect(screen.getByText(/불러오지 못했습니다/)).toBeTruthy();
  });
});
