import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getNotifications, putNotificationSettings } from '@/api/notifications.api';
import { useUiStore } from '@/store/ui.store';

/**
 * 관리자 알림(상단 바 종) — 서버가 하루 한 번(아침 8시) 세어 저장해 둔 값만 읽음(2026-11-05).
 * 값이 하루에 한 번 바뀌니 5분마다·창으로 돌아올 때만 다시 받음(저장 파일 읽기라 가볍다)
 */
export const useNotifications = () => {
  const adminAuthed = useUiStore(s => s.adminAuthed);
  return useQuery({
    queryKey:  ['notifications'],
    queryFn:   getNotifications,
    enabled:   adminAuthed,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
    meta: { queryType: 'notifications' },
  });
};

/**
 * 알림 확인 시각·빈도 저장(관리자 기능 > 알림 탭) — 응답이 조회와 같은 모양이라 캐시를 바로 교체하고
 * 종 아이콘·설정 화면이 같은 값을 봄. 실패하면 화면이 이전 값으로 남음(error로 알림)
 */
export const useSaveNotificationSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: putNotificationSettings,
    onSuccess: data => qc.setQueryData(['notifications'], data),
  });
};
