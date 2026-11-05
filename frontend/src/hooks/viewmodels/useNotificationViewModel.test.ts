import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { NotificationsResponse } from '@/api/notifications.api';

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
  beforeEach(() => { data = undefined; });

  it('데이터 전(미확인)이면 배지 없음', () => {
    const { result } = renderHook(() => useNotificationViewModel());
    expect(result.current.total).toBe(0);
    expect(result.current.badgeText).toBe('');
    expect(result.current.groups).toEqual([]);
    expect(result.current.checkedAt).toBeNull();
  });

  it('세 항목이 모두 0이면 배지 글자 없음', () => {
    data = base;
    const { result } = renderHook(() => useNotificationViewModel());
    expect(result.current.badgeText).toBe('');
    expect(result.current.groups).toEqual([]);
    expect(result.current.checkedAt).toBe('2026-11-06 08:00');
  });

  it('0이 아니면 합계가 배지 글자, 0인 항목·쪽은 목록에서 뺌', () => {
    data = { ...base, total: 7, finance: { pending: 1, failed: 0, modified: 2 }, kpi: { pending: 0, failed: 4, modified: 0 } };
    const { result } = renderHook(() => useNotificationViewModel());
    expect(result.current.badgeText).toBe('7');
    expect(result.current.groups.map(g => g.label)).toEqual(['재무', 'KPI']);
    expect(result.current.groups[0].items).toEqual([{ label: '아직 안 읽음', count: 1 }, { label: '원본 수정됨', count: 2 }]);
    expect(result.current.groups[1].items).toEqual([{ label: '열기 실패', count: 4 }]);
  });

  it('재무만 있으면 KPI 줄은 없음', () => {
    data = { ...base, total: 3, finance: { pending: 3, failed: 0, modified: 0 } };
    const { result } = renderHook(() => useNotificationViewModel());
    expect(result.current.groups.map(g => g.key)).toEqual(['finance']);
  });

  it('100건 이상은 "99+"', () => {
    data = { ...base, total: 120, finance: { pending: 120, failed: 0, modified: 0 } };
    const { result } = renderHook(() => useNotificationViewModel());
    expect(result.current.badgeText).toBe('99+');
  });

  it('마지막 시도가 막혔으면 checkFailed(숫자는 직전 결과)', () => {
    data = { ...base, total: 2, finance: { pending: 2, failed: 0, modified: 0 }, last_error: '원본 폴더에 접근할 수 없습니다' };
    const { result } = renderHook(() => useNotificationViewModel());
    expect(result.current.checkFailed).toBe(true);
    expect(result.current.badgeText).toBe('2');
  });

  it('일정을 한 줄 문구로 — 요일·시각·간격에 따라', () => {
    data = base;
    expect(renderHook(() => useNotificationViewModel()).result.current.scheduleText).toBe('매일 오전 8시에 확인');
    data = { ...base, settings: { ...base.settings, days: [0, 1, 2, 3, 4], times: ['08:00', '15:30'] }, slots: ['08:00', '15:30'] };
    expect(renderHook(() => useNotificationViewModel()).result.current.scheduleText).toBe('평일 하루 2회(오전 8시 · 오후 3시 30분) 확인');
    data = { ...base, settings: { ...base.settings, mode: 'interval', interval_minutes: 180 }, slots: ['08:00', '11:00', '14:00', '17:00'] };
    expect(renderHook(() => useNotificationViewModel()).result.current.scheduleText).toBe('매일 3시간마다(오전 8시~오후 6시) 확인');
  });

  it('끔이면 저장돼 있던 숫자가 있어도 배지·목록 없음', () => {
    data = { ...base, total: 5, finance: { pending: 5, failed: 0, modified: 0 }, settings: { ...base.settings, enabled: false } };
    const { result } = renderHook(() => useNotificationViewModel());
    expect(result.current.enabled).toBe(false);
    expect(result.current.badgeText).toBe('');
    expect(result.current.groups).toEqual([]);
    expect(result.current.scheduleText).toBe('확인 꺼짐');
  });
});
