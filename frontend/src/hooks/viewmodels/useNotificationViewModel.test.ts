import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { NotificationsResponse } from '@/api/notifications.api';
import { useUiStore } from '@/store';

let data: NotificationsResponse | undefined;
vi.mock('../useNotifications', () => ({ useNotifications: () => ({ data }) }));
import { useNotificationViewModel } from './useNotificationViewModel';

const base: NotificationsResponse = {
  ok: true, checked_at: '2026-11-06 08:00:05', last_attempt: '2026-11-06 08:00:05', last_error: null,
  finance: { pending: 0, failed: 0, modified: 0 }, kpi: { pending: 0, failed: 0, modified: 0 }, total: 0,
  settings: { enabled: true, days: [0, 1, 2, 3, 4, 5, 6], mode: 'times', times: ['08:00'], interval_minutes: 120, window_start: '08:00', window_end: '18:00' },
  slots: ['08:00'], next_check: '2026-11-07 08:00',
};

describe('useNotificationViewModel', () => {
  beforeEach(() => {
    data = undefined;
    useUiStore.setState({ notificationSeen: null });
  });

  it('데이터 전(미확인)이면 새 알림 없음', () => {
    const { result } = renderHook(() => useNotificationViewModel());
    expect(result.current.total).toBe(0);
    expect(result.current.unread).toBe(false);
    expect(result.current.groups).toEqual([]);
    expect(result.current.checkedAt).toBeNull();
  });

  it('세 항목이 모두 0이면 새 알림 없음 — 점도 팝업도 없음', () => {
    data = base;
    const { result } = renderHook(() => useNotificationViewModel());
    expect(result.current.unread).toBe(false);
    expect(result.current.summaryLines).toEqual([]);
    expect(result.current.checkedAt).toBe('2026-11-06 08:00');
  });

  it('0이 아닌 항목이 있고 아직 확인 안 했으면 새 알림, 0인 항목·쪽은 목록에서 뺌', () => {
    data = { ...base, total: 7, finance: { pending: 1, failed: 0, modified: 2 }, kpi: { pending: 0, failed: 4, modified: 0 } };
    const { result } = renderHook(() => useNotificationViewModel());
    expect(result.current.unread).toBe(true);
    expect(result.current.total).toBe(7);
    expect(result.current.groups.map(g => g.label)).toEqual(['재무', 'KPI']);
    expect(result.current.groups[0].items).toEqual([{ label: '아직 안 읽음', count: 1 }, { label: '원본 수정됨', count: 2 }]);
    expect(result.current.groups[1].items).toEqual([{ label: '열기 실패', count: 4 }]);
    expect(result.current.summaryLines).toEqual(['재무: 아직 안 읽음 1 · 원본 수정됨 2', 'KPI: 열기 실패 4']);
  });

  it('확인(markSeen)하면 점이 꺼지고, 숫자가 남아 있어도 다시 안 켜짐', () => {
    data = { ...base, total: 263, finance: { pending: 263, failed: 0, modified: 0 } };
    const { result, rerender } = renderHook(() => useNotificationViewModel());
    expect(result.current.unread).toBe(true);
    act(() => result.current.markSeen());
    expect(result.current.unread).toBe(false);
    expect(result.current.total).toBe(263);       // 목록엔 그대로 — 확인했다고 숫자가 사라지는 게 아님
    rerender();
    expect(result.current.unread).toBe(false);
  });

  it('확인한 뒤 건수가 늘면(새로 생김) 다시 켜짐', () => {
    data = { ...base, total: 5, finance: { pending: 5, failed: 0, modified: 0 } };
    const { result, rerender } = renderHook(() => useNotificationViewModel());
    act(() => result.current.markSeen());
    expect(result.current.unread).toBe(false);

    data = { ...base, total: 6, finance: { pending: 5, failed: 1, modified: 0 } };   // 열기 실패가 새로 생김
    rerender();
    expect(result.current.unread).toBe(true);
  });

  it('해결돼 줄었다가 나중에 다시 늘어도 새 알림으로 잡힘(확인 기록을 낮춰 둠)', () => {
    data = { ...base, total: 263, finance: { pending: 263, failed: 0, modified: 0 } };
    const { result, rerender } = renderHook(() => useNotificationViewModel());
    act(() => result.current.markSeen());

    data = { ...base, total: 5, finance: { pending: 5, failed: 0, modified: 0 } };   // 추출로 해결돼 줄어듦 — 새 알림 아님
    rerender();
    expect(result.current.unread).toBe(false);

    data = { ...base, total: 10, finance: { pending: 10, failed: 0, modified: 0 } };  // 263보다는 작지만 확인 후 늘어남
    rerender();
    expect(result.current.unread).toBe(true);
  });

  it('데이터 없이 markSeen을 불러도 확인 기록을 0으로 덮지 않는다(나중에 온 알림이 가려지면 안 됨)', () => {
    const { result, rerender } = renderHook(() => useNotificationViewModel());
    act(() => result.current.markSeen());
    expect(useUiStore.getState().notificationSeen).toBeNull();
    data = { ...base, total: 3, finance: { pending: 3, failed: 0, modified: 0 } };
    rerender();
    expect(result.current.unread).toBe(true);
  });

  it('마지막 시도가 막혔으면 checkFailed(숫자는 직전 결과)', () => {
    data = { ...base, total: 2, finance: { pending: 2, failed: 0, modified: 0 }, last_error: '원본 폴더에 접근할 수 없습니다' };
    const { result } = renderHook(() => useNotificationViewModel());
    expect(result.current.checkFailed).toBe(true);
    expect(result.current.total).toBe(2);
  });

  it('일정을 한 줄 문구로 — 요일·시각·간격에 따라', () => {
    data = base;
    expect(renderHook(() => useNotificationViewModel()).result.current.scheduleText).toBe('매일 오전 8시에 확인');
    data = { ...base, settings: { ...base.settings, days: [0, 1, 2, 3, 4], times: ['08:00', '15:30'] }, slots: ['08:00', '15:30'] };
    expect(renderHook(() => useNotificationViewModel()).result.current.scheduleText).toBe('평일 하루 2회(오전 8시 · 오후 3시 30분) 확인');
    data = { ...base, settings: { ...base.settings, mode: 'interval', interval_minutes: 180 }, slots: ['08:00', '11:00', '14:00', '17:00'] };
    expect(renderHook(() => useNotificationViewModel()).result.current.scheduleText).toBe('매일 3시간마다(오전 8시~오후 6시) 확인');
  });

  it('끔이면 저장돼 있던 숫자가 있어도 점·목록 없음', () => {
    data = { ...base, total: 5, finance: { pending: 5, failed: 0, modified: 0 }, settings: { ...base.settings, enabled: false } };
    const { result } = renderHook(() => useNotificationViewModel());
    expect(result.current.enabled).toBe(false);
    expect(result.current.unread).toBe(false);
    expect(result.current.total).toBe(0);
    expect(result.current.groups).toEqual([]);
    expect(result.current.scheduleText).toBe('확인 꺼짐');
  });
});
