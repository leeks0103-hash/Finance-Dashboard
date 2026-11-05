import { useMemo } from 'react';
import type { ExtractAlertCounts } from '@/api/notifications.api';
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
  /** 세 항목 합계 — 0이면 배지를 안 그림 */
  total: number;
  /** 배지에 쓰는 글자("99+" 상한) — total이 0이면 '' */
  badgeText: string;
  /** 0이 아닌 항목이 있는 쪽만(재무 → KPI 순) */
  groups: NotificationGroup[];
  /** 마지막 체크 시각 "YYYY-MM-DD HH:MM" — 한 번도 안 했으면 null */
  checkedAt: string | null;
  /** 마지막 시도가 막혔을 때(NAS 접근 실패 등) true — 숫자는 직전 체크 결과 */
  checkFailed: boolean;
  /** 확인이 꺼져 있으면 false — 종은 있고 배지는 없음(2026-11-05, 관리자가 알림 탭에서 끔) */
  enabled: boolean;
  /** "평일 하루 3회(오전 8시 · 오후 1시 · 오후 5시) 확인" 같은 한 줄 문구(관리자가 정한 일정) */
  scheduleText: string;
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

/** 알림 종 — 서버가 센 숫자를 화면용으로(배지 글자·0건 항목 제외). 숫자 계산은 서버, 여기선 표시용 정리만 */
export const useNotificationViewModel = (): NotificationViewModel => {
  const { data } = useNotifications();
  return useMemo(() => {
    const enabled = data?.settings?.enabled !== false;
    // 끔이면 저장돼 있던 옛 숫자가 있어도 배지·목록을 안 보임
    const total = enabled ? Math.max(0, data?.total ?? 0) : 0;
    return {
      total,
      badgeText: total === 0 ? '' : total > 99 ? '99+' : String(total),
      groups: enabled
        ? [toGroup('finance', '재무', data?.finance), toGroup('kpi', 'KPI', data?.kpi)].filter(g => g.items.length > 0)
        : [],
      checkedAt: data?.checked_at ? data.checked_at.slice(0, 16) : null,
      checkFailed: Boolean(data?.last_error),
      enabled,
      scheduleText: scheduleText(data?.settings, data?.slots),
    };
  }, [data]);
};
