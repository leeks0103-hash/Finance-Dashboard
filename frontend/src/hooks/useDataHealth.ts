import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ackDataHealth, exceptDataHealth, getDataHealth } from '@/api/dataHealth.api';
import type { DataHealthResponse } from '@/api/dataHealth.api';
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

/**
 * '수정 완료' 표시 켜고 끄기 — 누르는 즉시 화면 반영(낙관적), 실패하면 되돌림.
 * 서버에 남아서 다른 PC·관리자 화면에도 보임. 관리자가 재추출하면 서버가 저절로 지움
 */
export const useDataHealthAck = () => {
  const qc = useQueryClient();
  const authRole = useUiStore(s => s.authRole);
  const key = ['data-health', authRole];
  const mutation = useMutation({
    mutationFn: ({ file, done }: { file: string; done: boolean }) => ackDataHealth(file, done),
    onMutate: async ({ file, done }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DataHealthResponse>(key);
      if (prev) {
        const acks = { ...(prev.acks ?? {}) };
        if (done) acks[file] = { at: new Date().toISOString().slice(0, 19).replace('T', ' '), by: '' };
        else delete acks[file];
        qc.setQueryData<DataHealthResponse>(key, { ...prev, acks });
      }
      return { prev };
    },
    onError: (_e, _v, c) => { if (c?.prev) qc.setQueryData(key, c.prev); },
    // 다른 역할 캐시(관리자/일반)도 같이 맞추게 data-health 전부 다시 받음
    onSettled: () => qc.invalidateQueries({ queryKey: ['data-health'] }),
  });
  return { toggle: (file: string, done: boolean) => mutation.mutate({ file, done }) };
};

/**
 * 관리자 예외 처리 켜고 끄기(2026-11-10) — 서버가 판정(그 파일에 지금 이상이 있어야 함)하므로 낙관적 반영 없이
 * 응답 뒤 data-health를 다시 받음. 실패 이유(`error`)는 호출한 쪽이 보여 줌
 */
export const useDataHealthException = () => {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ files, done }: { files: string[]; done: boolean }) => exceptDataHealth(files, done),
    onSettled: () => qc.invalidateQueries({ queryKey: ['data-health'] }),
  });
  return {
    pending: mutation.isPending,
    set: (files: string[], done: boolean) => mutation.mutateAsync({ files, done }),
  };
};
