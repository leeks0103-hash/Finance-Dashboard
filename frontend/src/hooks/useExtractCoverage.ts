import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getExtractCoverage } from '@/api/extract.api';

/**
 * 관리자용 기능 모달의 "추출 현황" — 원본 폴더의 파일이 몇 개고 그중 몇 개가 실제로 추출됐는지, 안 된 건 무엇이고 왜인지.
 * 인증된 사람이 모달을 연 동안만 조회. 추출이 끝나는 순간(finishedAt이 바뀌면) 다시 셈
 */
export const useExtractCoverage = (enabled: boolean, finishedAt: string | null | undefined) => {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['extract-coverage'],
    queryFn:  () => getExtractCoverage(),
    enabled,
    staleTime: 30_000,
  });

  const lastFinished = useRef(finishedAt);
  useEffect(() => {
    if (!enabled || !finishedAt || finishedAt === lastFinished.current) return;
    lastFinished.current = finishedAt;
    qc.fetchQuery({ queryKey: ['extract-coverage'], queryFn: () => getExtractCoverage(true) });
  }, [enabled, finishedAt, qc]);

  const refresh = () => qc.fetchQuery({ queryKey: ['extract-coverage'], queryFn: () => getExtractCoverage(true) });

  return { data: query.data, isLoading: query.isLoading, isFetching: query.isFetching, refresh };
};
