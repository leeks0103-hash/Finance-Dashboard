import { useQuery } from '@tanstack/react-query';
import { getDataHealth } from '@/api/dataHealth.api';
import { STALE_5MIN, GC_10MIN } from './queryClient';
import { useUiStore } from '@/store/ui.store';

/**
 * KPI/재무 데이터가 같은 파일에서 서로 다른 프로젝트코드를 뽑아낸 경우를 감지.
 * 평소엔 안 보이고, count > 0일 때만 Navbar에 경고 뱃지를 띄우는 용도.
 * 관리자는 '생성 예정' 코드 불일치(오류 아님)도 받으므로 역할이 바뀌면 다시 조회.
 */
export const useDataHealth = () => {
  const authRole = useUiStore(s => s.authRole);
  return useQuery({
    queryKey:  ['data-health', authRole],
    queryFn:   getDataHealth,
    staleTime: STALE_5MIN,
    gcTime:    GC_10MIN,
    retry:     1,
    meta: { queryType: 'data-health' },
  });
};
