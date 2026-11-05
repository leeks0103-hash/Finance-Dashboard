import client from './client';
import { authHeaders } from './extract.api';

/** 추출 알림 — 서버 extract_alerts.py가 관리자가 정한 일정에 센 추출 현황 파일 수(2026-11-05). 관리자만 조회 */
export interface ExtractAlertCounts {
  /** 아직 안 읽음 — 새로 들어와 한 번도 추출 안 된 파일 */
  pending: number;
  /** 열기 실패 */
  failed: number;
  /** 원본 수정됨 — 마지막 추출 뒤에 원본이 바뀐 파일 */
  modified: number;
}

/** 확인 방식 — 정해진 시각에 / 시간대 안에서 일정 간격으로 */
export type NotificationMode = 'times' | 'interval';

/**
 * 관리자가 정하는 확인 일정(서버 data/extract_alerts_settings.json).
 * 사용 여부 · 요일 · 방식을 따로 정함 — 어느 방식이든 서버가 "하루 확인 시각 목록"(응답 slots)으로 풀어 같은 규칙으로 판단
 */
export interface NotificationSettings {
  enabled: boolean;
  /** 확인하는 요일 — 0=월 … 6=일 */
  days: number[];
  mode: NotificationMode;
  /** 정해진 시각 방식 — "HH:MM"(24시간제) 1~6개 */
  times: string[];
  /** 일정 간격 방식 — 분(30·60·120·180·240·360·480·720) */
  interval_minutes: number;
  /** 일정 간격 방식 — 확인 시간대 "HH:MM" (시작 시각부터 간격씩, 끝 시각 이하까지) */
  window_start: string;
  window_end: string;
}

export interface NotificationsResponse {
  ok: boolean;
  /** 마지막으로 성공한 체크 시각(YYYY-MM-DD HH:MM:SS) — 한 번도 안 했으면 null */
  checked_at: string | null;
  last_attempt: string | null;
  /** 마지막 시도가 NAS 접근 실패 등으로 막혔으면 이유(직전 숫자는 그대로 남아 있음) */
  last_error: string | null;
  finance: ExtractAlertCounts;
  kpi: ExtractAlertCounts;
  /** 재무+KPI 세 항목 합계 — 0이면 배지 없음 */
  total: number;
  settings: NotificationSettings;
  /** 하루에 확인하는 시각 목록("HH:MM", 서버가 풀어 줌 — 정해진 시각이면 그대로, 일정 간격이면 시간대 안 간격마다) */
  slots: string[];
  /** 다음 확인 시각(YYYY-MM-DD HH:MM, 서버가 계산) — 끔이면 null. 지금 해야 하는 상태면 지금 시각 */
  next_check: string | null;
}

export const getNotifications = (): Promise<NotificationsResponse> =>
  client.get('/notifications').then(r => r.data);

/** 관리자만 — 바꾼 항목만 보내면 나머지는 서버 값 유지. 응답은 알림 조회와 같은 모양(저장된 설정·slots·다음 확인 시각 포함) */
export const putNotificationSettings = (patch: Partial<NotificationSettings>): Promise<NotificationsResponse> =>
  client.put<NotificationsResponse>('/settings/notifications', patch, { headers: authHeaders() }).then(r => r.data);
