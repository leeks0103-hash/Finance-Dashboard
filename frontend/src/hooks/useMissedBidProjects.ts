import { useQuery } from '@tanstack/react-query';
import { getMissedBidProjects } from '@/api/finance.api';
import { useUiStore } from '@/store';
import { STALE_5MIN, GC_10MIN } from './queryClient';

/**
 * [미수주] 태그는 실적현황(신뢰 원본)엔 없고 재무(PPT) 비고란에만 있음 —
 * 담당자가 PPT 작성 시 수기로 남기는 태그라 재무 데이터에서 직접 조회.
 * 관리자만(2026-10-06) — 전용 API(/finance/missed-bid)가 서버에서 걸러 주고 로그인 안 하면 403.
 */
export const useMissedBidProjects = () => {
  const adminAuthed = useUiStore(s => s.adminAuthed);
  return useQuery({
    queryKey: ['finance-missed-bid'],
    queryFn:  getMissedBidProjects,
    enabled:  adminAuthed,
    staleTime: STALE_5MIN,
    gcTime:    GC_10MIN,
    meta: { queryType: 'finance-missed-bid' },
  });
};
