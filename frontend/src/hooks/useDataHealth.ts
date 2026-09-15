import { useQuery } from '@tanstack/react-query';
import { getDataHealth } from '@/api/dataHealth.api';
import { STALE_5MIN, GC_10MIN } from './queryClient';

/**
 * KPI/재무 데이터가 같은 파일에서 서로 다른 프로젝트코드를 뽑아낸 경우를 감지.
 * 평소엔 안 보이고, count > 0일 때만 Navbar에 경고 뱃지를 띄우는 용도.
 */
export const useDataHealth = () =>
  useQuery({
    queryKey:  ['data-health'],
    queryFn:   getDataHealth,
    staleTime: STALE_5MIN,
    gcTime:    GC_10MIN,
    retry:     1,
    meta: { queryType: 'data-health' },
  });
