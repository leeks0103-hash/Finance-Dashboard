import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getHeadcount, putHeadcount } from '@/api/settings.api';
import type { HeadcountSettings } from '@/types/settings.types';

const QUERY_KEY = ['settings-headcount'];
const EMPTY: HeadcountSettings = { parts: {}, updated_at: '', updated_by: '' };   // plan_parts(계획 인원) 주석 처리 2026-10-27

/**
 * 파트별 현재 인원(관리자 수기 입력, 서버 저장) — 인당 차트의 분모. 계획 인원은 2026-10-27 주석 처리.
 * 저장하면 인당 값이 든 실적 요약(['perf-summary'])을 바로 다시 불러와 차트가 갱신된다.
 */
export const useHeadcount = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: getHeadcount, staleTime: 30_000 });
  const mutation = useMutation({
    mutationFn: putHeadcount,
    onSuccess: saved => {
      qc.setQueryData(QUERY_KEY, saved);
      void qc.invalidateQueries({ queryKey: ['perf-summary'] });
    },
  });
  return {
    settings:  data ?? EMPTY,
    isLoading,
    save:      mutation.mutateAsync,
    isSaving:  mutation.isPending,
    error:     mutation.error,
  };
};
