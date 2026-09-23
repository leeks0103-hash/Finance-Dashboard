import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  runExtract, getExtractStatus, cancelExtract, authExtract,
  getStoredExtractKey, getStoredExtractName, setStoredExtractAuth,
} from '@/api/extract.api';
import type { ExtractTarget, ExtractMode } from '@/types/extract.types';

/**
 * Navbar ⚙ → PPT 데이터 추출. 권한(EXTRACT_ADMIN_KEY) 있는 사람에게만 보여야 해서, 인증
 * 여부도 이 훅이 갖고 있다가 통과 전엔 상태 폴링 자체를 안 함(2026-09-23 — "권한 있는 사람만
 * PPT 데이터 추출이 보일 수 있도록"). 실행은 서버 백그라운드 스레드로 돌고(최대 30분) 즉시
 * 응답이 오므로, 진행 상태는 짧은 주기로 폴링해서 반영한다.
 */
export const useExtractJob = () => {
  const qc = useQueryClient();
  const wasRunningRef = useRef(false);
  const [isAuthed, setIsAuthed] = useState(() => !!getStoredExtractKey());
  const [authedName, setAuthedName] = useState(() => getStoredExtractName());

  const statusQuery = useQuery({
    queryKey: ['extract-status'],
    queryFn:  getExtractStatus,
    enabled:  isAuthed,
    staleTime: 0,
    // 계속 폴링해야 "책임님이 실행 중이면 나는 disabled" 가 실시간으로 반영됨 — running일 때만
    // 폴링하면, 남이 막 시작한 걸 이 브라우저가 마지막으로 확인한 뒤로는 영영 모르게 됨
    // (2026-09-23, "권한 있는 사람의 경우 누군가 추출중이면 disabled처리해줘"). 인증된 사람만
    // 도는 폴링이라(2명뿐) 3초 주기로 항상 돌려도 부담 없음
    refetchInterval: 3000,
  });

  const status = statusQuery.data;

  // running true → false로 바뀌는 순간 = 방금 끝남 — 성공이면 전체 캐시 무효화해서
  // 새로 뽑힌 재무/KPI 데이터가 화면에 바로 반영되게 함 (useExport.ts reloadMutation과 동일 원칙)
  useEffect(() => {
    if (wasRunningRef.current && status && !status.running && status.ok) {
      qc.invalidateQueries();
    }
    wasRunningRef.current = !!status?.running;
  }, [status, qc]);

  const authMutation = useMutation({
    mutationFn: ({ key, name }: { key: string; name: string }) =>
      authExtract(key).then(ok => { if (ok) setStoredExtractAuth(key, name); return ok; }),
    onSuccess: (ok, { name }) => {
      if (ok) { setIsAuthed(true); setAuthedName(name); }
    },
  });

  const runMutation = useMutation({
    mutationFn: ({ targets, mode }: { targets: ExtractTarget[]; mode: ExtractMode }) =>
      runExtract(targets, mode),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['extract-status'] }); },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelExtract,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['extract-status'] }); },
  });

  return {
    isAuthed,
    authedName,
    authenticate:  authMutation.mutateAsync,
    isAuthing:     authMutation.isPending,
    status,
    isRunning:     !!status?.running,
    run:           runMutation.mutate,
    isStarting:    runMutation.isPending,
    startResult:   runMutation.data,
    cancel:        cancelMutation.mutate,
    isCancelling:  cancelMutation.isPending,
  };
};
