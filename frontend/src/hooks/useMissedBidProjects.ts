import { useQuery } from '@tanstack/react-query';
import { getProjects } from '@/api/finance.api';
import type { Filters } from '@/types/finance.types';
import { STALE_5MIN, GC_10MIN } from './queryClient';

const EMPTY_FILTERS: Filters = { years: [], parts: [], stages: [] };
const ALL_PAGE = { page: 1, pageSize: 500, search: '', field: '' };

/**
 * [미수주] 태그는 실적현황(신뢰 원본)엔 없고 재무(PPT) 비고란에만 있음 —
 * 담당자가 PPT 작성 시 수기로 남기는 태그라 재무 데이터에서 직접 조회.
 */
export const useMissedBidProjects = () =>
  useQuery({
    queryKey: ['finance-missed-bid'],
    queryFn:  () => getProjects(EMPTY_FILTERS, ALL_PAGE).then(r => r.data.filter(p => p.note?.includes('[미수주]'))),
    staleTime: STALE_5MIN,
    gcTime:    GC_10MIN,
    meta: { queryType: 'finance-missed-bid' },
  });
