import { useEffect, useRef, useState } from 'react';
import { useUiStore } from '@/store';
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
  // 마지막으로 본 '추출 완료 시각' — undefined = 아직 상태를 한 번도 못 받음
  const lastFinishedRef = useRef<string | null | undefined>(undefined);
  const [isAuthed, setIsAuthed] = useState(() => !!getStoredExtractKey());
  const [authedName, setAuthedName] = useState(() => getStoredExtractName());

  // 인증 여부를 store에도 — 바로가기(↗) 공개 범위 '관리자만' 판단용(useFileOpenVisible)
  const setAdminAuthed = useUiStore(s => s.setAdminAuthed);
  useEffect(() => { setAdminAuthed(isAuthed); }, [isAuthed, setAdminAuthed]);

  const statusQuery = useQuery({
    queryKey: ['extract-status'],
    queryFn:  getExtractStatus,
    staleTime: 0,
    // 계속 폴링해야 "책임님이 실행 중이면 나는 disabled" 가 실시간으로 반영됨 — running일 때만
    // 폴링하면, 남이 막 시작한 걸 이 브라우저가 마지막으로 확인한 뒤로는 영영 모르게 됨
    // (2026-09-23, "권한 있는 사람의 경우 누군가 추출중이면 disabled처리해줘"). 관리자(2명)는 3초.
    // 일반 사용자도 30초마다 확인 — 안 하면 남이 추출을 끝내도 5분 캐시가 끝날 때까지 옛 데이터가 보였음(2026-10-01)
    refetchInterval: isAuthed ? 3000 : 30_000,
  });

  const status = statusQuery.data;

  // 완료 시각(finished_at)이 바뀐 순간 = 방금 끝남 — 성공이면 전체 캐시 무효화해서
  // 새로 뽑힌 재무/KPI 데이터가 화면에 바로 반영되게 함 (useExport.ts reloadMutation과 동일 원칙).
  // 예전엔 running true → false 전환으로 판단해서, 폴링 사이에 시작·종료된 짧은 작업(실패 파일 재추출 등)이나
  // 폴링을 안 하던 일반 사용자 화면은 새로고침 전까지 옛 데이터였음(2026-10-01). 첫 응답은 기준값으로만 기억
  useEffect(() => {
    if (!status) return;
    const prev = lastFinishedRef.current;
    lastFinishedRef.current = status.finished_at;
    if (prev !== undefined && status.finished_at !== prev && !status.running && status.ok) {
      qc.invalidateQueries();
    }
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
