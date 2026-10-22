import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dismissExtractRequest, getExtractRequests } from '@/api/extractRequest.api';
import { useUiStore } from '@/store/ui.store';

/**
 * PPT 업데이트(재추출) 요청 목록 — 관리자만 조회(헤더 노란 "!", 2026-10-21).
 * 요청은 다른 사람 PC에서 남으니 10초마다 다시 받음. 재추출되면 서버가 저절로 지움
 */
export const useExtractRequests = () => {
  const adminAuthed = useUiStore(s => s.adminAuthed);
  return useQuery({
    queryKey:  ['extract-requests'],
    queryFn:   getExtractRequests,
    enabled:   adminAuthed,
    // 다른 PC에서 요청해도 새로고침 없이 뜨게(2026-10-22) — 전엔 60초 간격이라 늦고, 창이 뒷전이면 브라우저가
    // 폴링을 멈춰(기본값) 돌아와도 안 떴음 → 짧게 + 백그라운드에서도 + 창으로 돌아올 때 즉시
    staleTime: 0,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 1,
    meta: { queryType: 'extract-requests' },
  });
};

/** 관리자 — 추출 없이 요청 지우기 */
export const useDismissExtractRequest = () => {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: dismissExtractRequest,
    onSettled: () => qc.invalidateQueries({ queryKey: ['extract-requests'] }),
  });
  return (file: string) => m.mutate(file);
};
