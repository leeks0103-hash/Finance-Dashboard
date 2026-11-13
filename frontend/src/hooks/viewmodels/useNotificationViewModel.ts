import { useCallback, useEffect, useMemo } from 'react';
import type { ExtractAlertCounts } from '@/api/notifications.api';
import { useUiStore } from '@/store';
import { flattenCounts, hasUnseen, lowerSeen } from '@/utils/notificationSeen';
import { scheduleText } from '@/utils/notificationSchedule';
import { useNotifications } from '../useNotifications';

export interface NotificationItem { label: string; count: number }
export interface NotificationGroup {
  key: 'finance' | 'kpi';
  /** 재무 / KPI */
  label: string;
  /** 0이 아닌 항목만 */
  items: NotificationItem[];
}

export interface NotificationViewModel {
  /** 세 항목 합계 — 0이면 알릴 게 없음(점도 팝업도 없음) */
  total: number;
  /** 새로 확인할 게 있는지 — 종의 빨간 점·알림 팝업. 메일함처럼 종을 열어 확인하면 꺼지고, 확인한 뒤 건수가 늘 때만 다시 켜짐 */
  unread: boolean;
  /** 0이 아닌 항목이 있는 쪽만(재무 → KPI 순) */
  groups: NotificationGroup[];
  /** 팝업·툴팁용 줄 — "재무 — 아직 안 읽음 3 · 열기 실패 1" (groups와 같은 순서) */
  summaryLines: string[];
  /** 마지막 체크 시각 "YYYY-MM-DD HH:MM" — 한 번도 안 했으면 null */
  checkedAt: string | null;
  /** 마지막 시도가 막혔을 때(NAS 접근 실패 등) true — 숫자는 직전 체크 결과 */
  checkFailed: boolean;
  /** 확인이 꺼져 있으면 false — 종은 있고 점은 없음(2026-11-05, 관리자가 알림 탭에서 끔) */
  enabled: boolean;
  /** "평일 하루 3회(오전 8시 · 오후 1시 · 오후 5시) 확인" 같은 한 줄 문구(관리자가 정한 일정) */
  scheduleText: string;
  /** 종을 열었거나 팝업에서 확인했을 때 — 지금 건수를 "확인함"으로 기록해 빨간 점을 끔(이 브라우저에만 저장) */
  markSeen: () => void;
}

const LABELS: Array<[keyof ExtractAlertCounts, string]> = [
  ['pending', '아직 안 읽음'],
  ['failed', '열기 실패'],
  ['modified', '원본 수정됨'],
];

const toGroup = (key: 'finance' | 'kpi', label: string, c: ExtractAlertCounts | undefined): NotificationGroup => ({
  key, label,
  items: LABELS.map(([k, text]) => ({ label: text, count: c?.[k] ?? 0 })).filter(i => i.count > 0),
});

/**
 * 알림 종 — 서버가 센 숫자를 화면용으로(0건 항목 제외) + 메일함 같은 "새 알림" 판정(2026-11-06).
 * 숫자 계산은 서버, 여기선 표시용 정리와 "확인한 뒤로 늘었나" 비교만(이 브라우저에 확인 기록)
 */
export const useNotificationViewModel = (): NotificationViewModel => {
  const { data } = useNotifications();
  const seen = useUiStore(s => s.notificationSeen);
  const setSeen = useUiStore(s => s.setNotificationSeen);

  const counts = useMemo(() => flattenCounts(data?.finance, data?.kpi), [data]);
  const enabled = data?.settings?.enabled !== false;
  // 끔이거나 아직 한 번도 못 받았으면 알릴 것 없음 — 점도 팝업도 안 뜸(끄면 저장돼 있던 옛 숫자도 숨김)
  const active = !!data && enabled;

  // 해결돼 줄어든 만큼 확인 기록도 낮춤 — 안 그러면 확인 때 263건 → 5건으로 줄었다 10건으로 늘어도 점이 안 켜짐
  useEffect(() => {
    if (!active) return;
    const lowered = lowerSeen(counts, seen);
    if (lowered && lowered !== seen) setSeen(lowered);
  }, [active, counts, seen, setSeen]);

  const markSeen = useCallback(() => { if (data) setSeen(counts); }, [data, counts, setSeen]);

  const view = useMemo(() => {
    const groups = enabled
      ? [toGroup('finance', '재무', data?.finance), toGroup('kpi', 'KPI', data?.kpi)].filter(g => g.items.length > 0)
      : [];
    return {
      total: enabled ? Math.max(0, data?.total ?? 0) : 0,
      groups,
      summaryLines: groups.map(g => `${g.label}: ${g.items.map(i => `${i.label} ${i.count}`).join(' · ')}`),
      checkedAt: data?.checked_at ? data.checked_at.slice(0, 16) : null,
      checkFailed: Boolean(data?.last_error),
      enabled,
      scheduleText: scheduleText(data?.settings, data?.slots),
    };
  }, [data, enabled]);

  return { ...view, unread: active && hasUnseen(counts, seen), markSeen };
};
