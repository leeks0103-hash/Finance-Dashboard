import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPerfUpdateNote, putPerfUpdateNote } from '@/api/settings.api';
import type { PerfUpdateNote } from '@/types/settings.types';

const QUERY_KEY = ['settings-perf-update'];
const DEFAULTS: PerfUpdateNote = { label: '경영실적 현황 업데이트', note: '' };

/** 실적 탭 "경영실적 현황 업데이트" 칸 — 서버 저장(모든 화면 같은 값), 관리자가 바꾸면 다른 화면엔 1분 안에 반영 */
export const usePerfUpdateNote = () => {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn:  getPerfUpdateNote,
    staleTime: 0,
    refetchInterval: 60_000,
  });
  const mutation = useMutation({
    mutationFn: putPerfUpdateNote,
    // 저장 응답 오기 전에도 바로 바뀐 값으로 — 실패하면 서버 값으로 되돌림
    onMutate: patch => {
      const prev = qc.getQueryData<PerfUpdateNote>(QUERY_KEY);
      qc.setQueryData(QUERY_KEY, { ...(prev ?? DEFAULTS), ...patch });
      return { prev };
    },
    onError:   (_e, _p, ctx) => qc.setQueryData(QUERY_KEY, ctx?.prev),
    onSuccess: saved => qc.setQueryData(QUERY_KEY, saved),
  });
  return {
    value:  data ?? DEFAULTS,
    update: mutation.mutate,
  };
};
