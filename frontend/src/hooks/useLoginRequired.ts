import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getLoginRequired, putLoginRequired } from '@/api/settings.api';

export const LOGIN_REQUIRED_KEY = ['login-required'];

/**
 * 들어가자마자 로그인을 요구할지(2026-10-22) — 예전엔 코드 주석(authMode.ts + app.py)으로 껐다 켰는데 관리자 기능 토글로.
 * 서버(data/access.json)가 정답이라 이 값으로 로그인 화면·관리자 창 분기를 정함. 서버가 안 닿거나 값이 없으면 **요구함**(안전한 쪽).
 * 다른 브라우저가 바뀐 값을 알도록 30초마다·창으로 돌아올 때 다시 받음
 */
export const useLoginRequired = () => {
  const { data, isPending } = useQuery({
    queryKey: LOGIN_REQUIRED_KEY,
    queryFn:  getLoginRequired,
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  return {
    loginRequired: data ?? true,
    /** 처음 값이 오기 전 — 이 동안은 로그인 화면을 그릴지 몰라 아무것도 안 그림 */
    isLoading: isPending,
  };
};

/** 관리자 — 로그인 요구 켜기/끄기. 낙관적 반영(실패하면 되돌림) */
export const useSetLoginRequired = () => {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: putLoginRequired,
    onMutate: async (next: boolean) => {
      await qc.cancelQueries({ queryKey: LOGIN_REQUIRED_KEY });
      const prev = qc.getQueryData<boolean>(LOGIN_REQUIRED_KEY);
      qc.setQueryData(LOGIN_REQUIRED_KEY, next);
      return { prev };
    },
    onError: (_e, _v, c) => { if (c?.prev !== undefined) qc.setQueryData(LOGIN_REQUIRED_KEY, c.prev); },
    onSuccess: saved => qc.setQueryData(LOGIN_REQUIRED_KEY, saved),
  });
  return { set: m.mutate, isError: m.isError, isSaving: m.isPending };
};

/** 로그인 상태가 바뀔 때 이전 화면 데이터를 비움 — 로그인 요구 값은 남김(지우면 앱이 "확인 중"으로 되돌아가 깜빡임) */
export const clearDataCaches = (qc: QueryClient) =>
  qc.removeQueries({ predicate: q => q.queryKey[0] !== LOGIN_REQUIRED_KEY[0] });
