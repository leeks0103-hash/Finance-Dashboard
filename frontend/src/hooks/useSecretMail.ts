import { useEffect, useRef } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelSecretMail, getSecretMailAccountDiff, getSecretMailPreview, getSecretMailRoster, getSecretMailStatus, startSecretMail } from '@/api/secretMail.api';
import type { SecretMailSendBody } from '@/types/secretMail.types';

const ROSTER_KEY = ['secret-mail-roster'];
const STATUS_KEY = ['secret-mail-status'];

/** axios 오류 → 서버가 준 한 줄 설명 */
const errorText = (e: unknown): string => {
  const data = (e as { response?: { data?: { error?: string } } })?.response?.data;
  return data?.error ?? (e instanceof Error ? e.message : '요청에 실패했습니다');
};

/**
 * 관리자 기능 > 시크릿 키 메일(2026-10-22) — 명단은 펼쳤을 때만 받고, 보내는 동안엔 1.2초마다 진행 상황을 받음.
 * 다 보내면 명단을 다시 받아 '보냄' 표시를 갱신
 */
export const useSecretMail = (enabled: boolean) => {
  const qc = useQueryClient();
  const roster = useQuery({
    queryKey: ROSTER_KEY,
    queryFn: getSecretMailRoster,
    enabled,
    staleTime: 30_000,
    retry: 0,
  });

  const status = useQuery({
    queryKey: STATUS_KEY,
    queryFn: getSecretMailStatus,
    enabled,
    refetchInterval: q => (q.state.data?.job.running ? 1200 : false),
  });
  const job = status.data?.job ?? roster.data?.job;
  const running = !!job?.running;

  // 보내기가 끝나는 순간 명단(보냄 시각) 다시 받기
  const wasRunning = useRef(running);
  useEffect(() => {
    if (wasRunning.current && !running) void qc.invalidateQueries({ queryKey: ROSTER_KEY });
    wasRunning.current = running;
  }, [running, qc]);

  const start = useMutation({
    mutationFn: (body: SecretMailSendBody) => startSecretMail(body),
    onSuccess: d => qc.setQueryData(STATUS_KEY, d),
  });
  const cancel = useMutation({
    mutationFn: cancelSecretMail,
    onSuccess: d => qc.setQueryData(STATUS_KEY, d),
  });

  return {
    data: roster.data,
    isLoading: roster.isLoading,
    loadError: roster.isError ? errorText(roster.error) : roster.data?.error ?? null,
    refetch: () => void roster.refetch(),
    job,
    running,
    start: (body: SecretMailSendBody) => start.mutate(body),
    isStarting: start.isPending,
    startError: start.isError ? errorText(start.error) : null,
    cancel: () => cancel.mutate(),
    isCancelling: cancel.isPending,
  };
};

/** 미리보기 — 고른 사람에게 갈 메일(키만 가림) */
export const useSecretMailPreview = (emp: string | null) => {
  const q = useQuery({
    queryKey: ['secret-mail-preview', emp],
    queryFn: () => getSecretMailPreview(emp!),
    enabled: !!emp,
    // 받는 사람을 바꾸는 동안 이전 메일을 그대로 두고 새 값이 오면 교체 — 안 그러면 data가 비는 순간 메일 칸이 사라져 모달 높이가 줄었다 늘었다 함(2026-10-23)
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 0,
  });
  return { data: q.data, isLoading: q.isLoading, error: q.isError ? errorText(q.error) : null };
};

/** 명단 보기를 펼칠 때마다 명단 엑셀 vs .env 일반 회원 대조(읽기만) — 반영은 사람이 터미널에서 */
export const useSecretMailAccountDiff = (enabled: boolean) => {
  const q = useQuery({
    queryKey: ['secret-mail-account-diff'],
    queryFn: getSecretMailAccountDiff,
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 0,
  });
  return {
    data: q.data,
    isLoading: q.isLoading,
    isFetching: q.isFetching,
    error: q.isError ? errorText(q.error) : q.data?.error ?? null,
    refetch: () => void q.refetch(),
  };
};
