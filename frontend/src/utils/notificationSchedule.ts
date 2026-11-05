import type { NotificationSettings } from '@/api/notifications.api';

/** 요일 이름 — 서버 days 값(0=월 … 6=일)과 같은 순서 */
export const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [0, 1, 2, 3, 4];
const WEEKEND = [5, 6];

/** 요일 선택 상자 — custom은 "직접 선택"(요일 버튼이 나옴) */
export type DaysPreset = 'all' | 'weekdays' | 'weekend' | 'custom';

export const DAYS_PRESET_OPTIONS: Array<{ value: DaysPreset; label: string }> = [
  { value: 'all',      label: '매일' },
  { value: 'weekdays', label: '평일 (월~금)' },
  { value: 'weekend',  label: '주말 (토·일)' },
  { value: 'custom',   label: '요일 직접 선택' },
];

export const PRESET_DAYS: Record<Exclude<DaysPreset, 'custom'>, number[]> = { all: ALL_DAYS, weekdays: WEEKDAYS, weekend: WEEKEND };

const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((d, i) => d === b[i]);

/** 저장된 요일 목록이 어떤 묶음인지 — 해당 없으면 custom */
export const daysPreset = (days: number[]): DaysPreset => {
  const sorted = [...days].sort((x, y) => x - y);
  if (sameDays(sorted, ALL_DAYS)) return 'all';
  if (sameDays(sorted, WEEKDAYS)) return 'weekdays';
  if (sameDays(sorted, WEEKEND)) return 'weekend';
  return 'custom';
};

/** 확인 방식 선택 상자 */
export const MODE_OPTIONS: Array<{ value: NotificationSettings['mode']; label: string }> = [
  { value: 'times',    label: '정해진 시각에 확인' },
  { value: 'interval', label: '일정 간격으로 확인' },
];

/** 간격 선택 상자 — 서버 extract_alerts.INTERVAL_CHOICES(분)와 같아야 함. 하루 한 번은 "정해진 시각" 방식으로 */
export const INTERVAL_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 30,  label: '30분마다' },
  { value: 60,  label: '1시간마다' },
  { value: 120, label: '2시간마다' },
  { value: 180, label: '3시간마다' },
  { value: 240, label: '4시간마다' },
  { value: 360, label: '6시간마다' },
  { value: 480, label: '8시간마다' },
  { value: 720, label: '12시간마다' },
];

/** 정해진 시각 방식에서 하루 최대 횟수 — 서버 extract_alerts.MAX_TIMES와 같아야 함 */
export const MAX_TIMES = 6;

/** "08:00" → "오전 8시", "15:30" → "오후 3시 30분", "00:00" → "오전 12시" — 안내 문구용 */
export const formatClock = (hhmm: string): string => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}시${min ? ` ${min}분` : ''}`;
};

/** 요일 문구 — 매일 / 평일 / 주말 / "월·수·금" */
export const daysText = (days: number[]): string => {
  const preset = daysPreset(days);
  if (preset === 'all') return '매일';
  if (preset === 'weekdays') return '평일';
  if (preset === 'weekend') return '주말';
  return [...days].sort((x, y) => x - y).map(d => DAY_LABELS[d]).join('·');
};

/**
 * 일정을 한 줄 문구로 — 종 드롭다운·설정 화면 공용. slots는 서버가 풀어 준 "하루 확인 시각 목록".
 * 예: "매일 오전 8시에 확인" / "평일 하루 3회(오전 8시 · 오후 1시 · 오후 5시) 확인" / "월·수 2시간마다(오전 9시~오후 6시) 확인" / "확인 꺼짐"
 */
export const scheduleText = (s: NotificationSettings | undefined, slots: string[] | undefined): string => {
  if (!s) return '';
  if (!s.enabled) return '확인 꺼짐';
  const days = daysText(s.days);
  if (s.mode === 'interval') {
    const label = INTERVAL_OPTIONS.find(o => o.value === s.interval_minutes)?.label ?? `${s.interval_minutes}분마다`;
    return `${days} ${label}(${formatClock(s.window_start)}~${formatClock(s.window_end)}) 확인`;
  }
  const list = slots ?? s.times;
  if (list.length === 1) return `${days} ${formatClock(list[0])}에 확인`;
  return `${days} 하루 ${list.length}회(${list.map(formatClock).join(' · ')}) 확인`;
};
