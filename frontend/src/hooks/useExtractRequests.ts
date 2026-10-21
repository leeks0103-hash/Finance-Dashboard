import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dismissExtractRequest, getExtractRequests } from '@/api/extractRequest.api';
import { useUiStore } from '@/store/ui.store';

/**
 * PPT 업데이트(재추출) 요청 목록 — 관리자만 조회(헤더 노란 "!", 2026-10-21).
 * 요청은 다른 사람 PC에서 남으니 1분마다 다시 받음. 재추출되면 서버가 저절로 지움
 */
export const useExtractRequests = () => {
  const adminAuthed = useUiStore(s => s.adminAuthed);
  return useQuery({
    queryKey:  ['extract-requests'],
    queryFn:   getExtractRequests,
    enabled:   adminAuthed,
    staleTime: 30_000,
    refetchInterval: 60_000,
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
