import { describe, it, expect } from 'vitest';
import { flattenCounts, hasUnseen, lowerSeen } from './notificationSeen';

const counts = (fp = 0, ff = 0, fm = 0, kp = 0, kf = 0, km = 0) =>
  flattenCounts({ pending: fp, failed: ff, modified: fm }, { pending: kp, failed: kf, modified: km });

describe('notificationSeen — 메일함처럼 확인하면 꺼지고 새로 늘면 켜짐', () => {
  it('flattenCounts: 재무·KPI 항목별로 풀고 없는 값은 0', () => {
    expect(flattenCounts({ pending: 3 }, undefined)).toEqual({
      'finance.pending': 3, 'kpi.pending': 0, 'finance.failed': 0, 'kpi.failed': 0, 'finance.modified': 0, 'kpi.modified': 0,
    });
  });

  it('한 번도 확인 안 했으면(seen 없음) 0이 아닌 항목이 있을 때만 새 알림', () => {
    expect(hasUnseen(counts(), null)).toBe(false);
    expect(hasUnseen(counts(0, 0, 0, 0, 2), null)).toBe(true);
  });

  it('확인한 그대로면 새 알림 아님 — 숫자가 남아 있어도 점은 꺼짐', () => {
    const seen = counts(263, 0, 0, 263);
    expect(hasUnseen(counts(263, 0, 0, 263), seen)).toBe(false);
  });

  it('줄었으면 새 알림 아님, 한 항목이라도 늘면 새 알림', () => {
    const seen = counts(10, 0, 0, 10);
    expect(hasUnseen(counts(4, 0, 0, 10), seen)).toBe(false);
    expect(hasUnseen(counts(10, 1, 0, 10), seen)).toBe(true);     // 열기 실패가 새로 생김
    expect(hasUnseen(counts(10, 0, 0, 11), seen)).toBe(true);     // KPI 안 읽음이 늘어남
  });

  it('lowerSeen: 해결돼 줄어든 만큼 확인 기록도 낮춰서, 나중에 다시 늘면 새 알림으로 잡힘', () => {
    const seen = counts(263, 0, 0, 263);
    const lowered = lowerSeen(counts(5, 0, 0, 5), seen)!;
    expect(lowered['finance.pending']).toBe(5);
    expect(hasUnseen(counts(10, 0, 0, 5), lowered)).toBe(true);      // 낮추지 않았다면 263보다 작아 점이 안 켜졌을 것
  });

  it('lowerSeen: 낮출 게 없으면 같은 객체(불필요한 저장 방지), 기록이 없으면 null', () => {
    const seen = counts(3, 0, 0, 3);
    expect(lowerSeen(counts(9, 0, 0, 9), seen)).toBe(seen);
    expect(lowerSeen(counts(9), null)).toBeNull();
  });
});
