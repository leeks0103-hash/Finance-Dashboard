import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPerfUpdateStatus, retryPerfUpdate, uploadPerfFile } from '@/api/performance.api';
import type { PerfUpdateStatus } from '@/types/performance.types';

const KEY = ['perf-update-status'];

/** 관리자 기능 창 — 실적현황 파일 자동 반영 상태 + 올리기·다시 시도. 반영되면 대시보드 데이터 전부 다시 받음 */
export const usePerfUpdateStatus = () => {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: getPerfUpdateStatus, staleTime: 0, refetchInterval: 30_000 });

  const done = (st: PerfUpdateStatus) => {
    qc.setQueryData(KEY, st);
    qc.invalidateQueries({ predicate: q => q.queryKey[0] !== KEY[0] });
  };
  const upload = useMutation({ mutationFn: uploadPerfFile, onSuccess: done });
  const retry  = useMutation({ mutationFn: retryPerfUpdate, onSuccess: done });

  return {
    status:    query.data,
    isLoading: query.isLoading,
    upload,
    retry,
    busy:      upload.isPending || retry.isPending,
  };
};
