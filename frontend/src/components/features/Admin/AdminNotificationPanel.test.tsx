import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { NotificationSettings } from '@/api/notifications.api';

const update = vi.fn();
let settings: NotificationSettings | undefined;
let slots: string[] = ['08:00'];
let loadFailed = false;
let saveError: string | null = null;
vi.mock('@/hooks/viewmodels/useAdminNotificationViewModel', () => ({
  useAdminNotificationViewModel: () => ({
    settings, slots, loadFailed, isLoading: false, saving: false, saveError, update,
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

  it('설정만 보여 준다 — 지금 알림 건수·마지막/다음 확인·[추출 현황 보기]는 이 탭에 없음(2026-11-06 요청)', () => {
    render(<AdminNotificationPanel />);
    expect(screen.queryByText(/지금 알림/)).toBeNull();
    expect(screen.queryByText(/마지막 확인/)).toBeNull();
    expect(screen.queryByText(/다음 확인/)).toBeNull();
    expect(screen.queryByRole('button', { name: '추출 현황 보기' })).toBeNull();
    expect(document.querySelector('li')).toBeNull();
    expect(screen.getByText('확인 일정')).toBeTruthy();
  });

  it('안내 문구는 숫자가 아니라 알림 팝업·빨간 점을 말한다', () => {
    render(<AdminNotificationPanel />);
    expect(screen.getByText(/알림 팝업이 뜨고 종에 빨간 점이 켜지며/)).toBeTruthy();
    expect(screen.queryByText(/숫자로/)).toBeNull();
  });

  it('요일 선택 상자 — 평일·주말을 고르면 그 요일 목록 저장', () => {
    render(<AdminNotificationPanel />);
    fireEvent.change(select('확인할 요일'), { target: { value: 'weekdays' } });
    expect(update).toHaveBeenLastCalledWith({ days: [0, 1, 2, 3, 4] });
    fireEvent.change(select('확인할 요일'), { target: { value: 'weekend' } });
    expect(update).toHaveBeenLastCalledWith({ days: [5, 6] });
  });

  it('요일 직접 선택 — 요일 버튼이 나오고 누르면 그 요일만 켜고 끔(마지막 하나는 못 끔)', () => {
    settings = { ...base, days: [0, 2] };
    render(<AdminNotificationPanel />);
    expect(select('확인할 요일').value).toBe('custom');
    fireEvent.click(screen.getByRole('button', { name: '금' }));
    expect(update).toHaveBeenLastCalledWith({ days: [0, 2, 4] });
    fireEvent.click(screen.getByRole('button', { name: '월' }));
    expect(update).toHaveBeenLastCalledWith({ days: [2] });
  });

  it('요일이 하나만 남으면 그 요일은 끌 수 없음', () => {
    settings = { ...base, days: [3] };
    render(<AdminNotificationPanel />);
    update.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '목' }));
    expect(update).not.toHaveBeenCalled();
  });

  it('방식 선택 상자로 정해진 시각 ↔ 일정 간격 전환', () => {
    render(<AdminNotificationPanel />);
    fireEvent.change(select('확인 방식'), { target: { value: 'interval' } });
    expect(update).toHaveBeenLastCalledWith({ mode: 'interval' });
  });

  it('정해진 시각 — 입력 중엔 저장 안 하고 벗어날 때 저장, 여러 시각 추가·삭제', () => {
    settings = { ...base, times: ['08:00', '13:00'] };
    slots = ['08:00', '13:00'];
    render(<AdminNotificationPanel />);
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
    render(<AdminNotificationPanel />);
    expect(screen.queryByRole('button', { name: /지우기/ })).toBeNull();
  });

  it('시각이 6개면 추가 버튼이 없음', () => {
    settings = { ...base, times: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'] };
    slots = settings.times;
    render(<AdminNotificationPanel />);
    expect(screen.queryByRole('button', { name: '+ 시각 추가' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /지우기/ }).length).toBe(6);
  });

  it('일정 간격 — 간격 선택 상자·시간대 입력, 하루 확인 시각 목록 미리보기', () => {
    settings = { ...base, mode: 'interval' };
    slots = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
    render(<AdminNotificationPanel />);
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
    render(<AdminNotificationPanel />);
    const start = screen.getByLabelText('확인 시간대 시작') as HTMLInputElement;
    fireEvent.change(start, { target: { value: '19:00' } });
    fireEvent.blur(start);
    expect(update).not.toHaveBeenCalled();
  });

  it('사용 토글을 끄면 저장', () => {
    render(<AdminNotificationPanel />);
    fireEvent.click(screen.getByRole('switch'));
    expect(update).toHaveBeenLastCalledWith({ enabled: false });
  });

  it('꺼져 있으면 요일·방식 입력이 없음', () => {
    settings = { ...base, enabled: false };
    render(<AdminNotificationPanel />);
    expect(screen.queryByLabelText('확인 방식')).toBeNull();
    expect(screen.queryByLabelText('확인할 요일')).toBeNull();
  });

  it('서버가 거절한 이유(저장 오류)를 그대로 보여 줌', () => {
    saveError = '확인 시간대의 시작은 끝보다 빨라야 합니다';
    render(<AdminNotificationPanel />);
    expect(screen.getByText('확인 시간대의 시작은 끝보다 빨라야 합니다')).toBeTruthy();
  });

  it('설정을 못 불러오면 안내', () => {
    settings = undefined;
    loadFailed = true;
    render(<AdminNotificationPanel />);
    expect(screen.getByText(/불러오지 못했습니다/)).toBeTruthy();
  });
});
