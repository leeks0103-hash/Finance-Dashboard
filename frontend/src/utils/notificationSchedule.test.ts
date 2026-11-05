import { describe, it, expect } from 'vitest';
import type { NotificationSettings } from '@/api/notifications.api';
import { daysPreset, daysText, formatClock, scheduleText, PRESET_DAYS } from './notificationSchedule';

const base: NotificationSettings = {
  enabled: true, days: [0, 1, 2, 3, 4, 5, 6], mode: 'times', times: ['08:00'],
  interval_minutes: 120, window_start: '08:00', window_end: '18:00',
};

describe('formatClock', () => {
  it('24시간제를 오전/오후로', () => {
    expect(formatClock('08:00')).toBe('오전 8시');
    expect(formatClock('00:00')).toBe('오전 12시');
    expect(formatClock('12:00')).toBe('오후 12시');
    expect(formatClock('15:30')).toBe('오후 3시 30분');
    expect(formatClock('23:05')).toBe('오후 11시 5분');
  });
  it('형식이 이상하면 그대로', () => {
    expect(formatClock('아침')).toBe('아침');
  });
});

describe('요일', () => {
  it('저장된 요일이 어떤 묶음인지', () => {
    expect(daysPreset([0, 1, 2, 3, 4, 5, 6])).toBe('all');
    expect(daysPreset([4, 3, 2, 1, 0])).toBe('weekdays');     // 순서 상관없음
    expect(daysPreset([5, 6])).toBe('weekend');
    expect(daysPreset([0, 2, 4])).toBe('custom');
    expect(daysPreset([0])).toBe('custom');
  });
  it('묶음을 고르면 보낼 요일 목록', () => {
    expect(PRESET_DAYS.all).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(PRESET_DAYS.weekdays).toEqual([0, 1, 2, 3, 4]);
    expect(PRESET_DAYS.weekend).toEqual([5, 6]);
  });
  it('요일 문구', () => {
    expect(daysText([0, 1, 2, 3, 4, 5, 6])).toBe('매일');
    expect(daysText([0, 1, 2, 3, 4])).toBe('평일');
    expect(daysText([5, 6])).toBe('주말');
    expect(daysText([4, 0, 2])).toBe('월·수·금');
  });
});

describe('scheduleText', () => {
  it('정해진 시각 — 한 번이면 그 시각, 여러 번이면 하루 N회', () => {
    expect(scheduleText(base, ['08:00'])).toBe('매일 오전 8시에 확인');
    expect(scheduleText({ ...base, days: [0, 1, 2, 3, 4], times: ['08:00', '13:00', '17:00'] }, ['08:00', '13:00', '17:00']))
      .toBe('평일 하루 3회(오전 8시 · 오후 1시 · 오후 5시) 확인');
  });
  it('일정 간격 — 간격과 시간대', () => {
    expect(scheduleText({ ...base, mode: 'interval', days: [0, 2], interval_minutes: 120, window_start: '09:00', window_end: '18:00' }, []))
      .toBe('월·수 2시간마다(오전 9시~오후 6시) 확인');
    expect(scheduleText({ ...base, mode: 'interval', interval_minutes: 30 }, []))
      .toBe('매일 30분마다(오전 8시~오후 6시) 확인');
  });
  it('끔·값 없음', () => {
    expect(scheduleText({ ...base, enabled: false }, ['08:00'])).toBe('확인 꺼짐');
    expect(scheduleText(undefined, undefined)).toBe('');
  });
});
