import type { NotificationSettings } from '@/api/notifications.api';
import { useNotifications, useSaveNotificationSettings } from '../useNotifications';

/** 서버가 돌려준 오류 문구(400의 error) — 없으면 기본 문구 */
const errorText = (e: unknown): string =>
  (e as { response?: { data?: { error?: string } } } | null)?.response?.data?.error
  ?? '저장하지 못했습니다 — 다시 시도해 주세요';

/**
 * 관리자 기능 > 알림 탭(2026-11-05) — 확인 일정 설정만(2026-11-06부터 "지금 알림 N건" 요약은 뺌 — 현황은 종 드롭다운·알림 팝업·추출 현황에서).
 * 일정은 바꾸는 즉시 서버에 저장하고 응답으로 캐시를 교체(그래서 종 드롭다운 문구가 바로 바뀜).
 * 하루 확인 시각 목록(slots)은 서버가 계산해 줌
 */
export const useAdminNotificationViewModel = () => {
  const { data, isLoading, isError } = useNotifications();
  const save = useSaveNotificationSettings();

  return {
    settings: data?.settings,
    /** 하루에 확인하는 시각 목록 — 정해진 시각이면 그대로, 일정 간격이면 서버가 시간대 안 간격마다로 풀어 준 것 */
    slots: data?.slots ?? [],
    /** 서버 응답을 한 번도 못 받았을 때(일정을 못 보여 줌) */
    loadFailed: isError && !data,
    isLoading,
    saving: save.isPending,
    /** 마지막 저장이 실패했을 때 그 이유(서버 400 문구 그대로) — 성공하면 null */
    saveError: save.isError ? errorText(save.error) : null,
    /** 바꾼 항목만 서버에 저장 — 나머지는 서버가 저장돼 있던 값 유지 */
    update: (patch: Partial<NotificationSettings>) => save.mutate(patch),
  };
};
