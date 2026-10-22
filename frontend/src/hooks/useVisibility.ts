import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUiStore } from '@/store';
import { getVisibility, putVisibility } from '@/api/settings.api';
import type { VisibilitySettings } from '@/types/settings.types';

const QUERY_KEY = ['settings-visibility'];

/** 서버가 응답하기 전·실패 시 기본값 — 서버 기본값과 같게(바로가기 관리자만, 달성률 숨김) */
const DEFAULTS: VisibilitySettings = { fileOpen: 'admin', folderOpen: 'admin', achieveRate: 'none', aiInsight: 'none', extractRequest: 'all' };

/** 기능별 공개 범위(서버 저장) — 관리자가 바꾸면 다른 화면엔 1분 안에 반영 */
export const useVisibilitySettings = () => {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn:  getVisibility,
    staleTime: 0,
    refetchInterval: 60_000,
  });
  // 낙관적 반영 — 누르는 즉시 화면을 바꾸고 저장은 뒤에서. 예전엔 서버 응답까지 선택 표시가 안 옮겨가고
  // 그동안 버튼이 전부 잠겨(흐려져) 누를 때마다 깜빡였음(2026-10-20). 실패하면 이전 값으로 되돌림
  const mutation = useMutation({
    mutationFn: putVisibility,
    onMutate: async (patch: Partial<VisibilitySettings>) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<VisibilitySettings>(QUERY_KEY);
      qc.setQueryData<VisibilitySettings>(QUERY_KEY, { ...DEFAULTS, ...prev, ...patch });
      return { prev };
    },
    onError: (_e, _patch, c) => { if (c?.prev) qc.setQueryData(QUERY_KEY, c.prev); },
    onSuccess: saved => qc.setQueryData(QUERY_KEY, saved),
  });
  return {
    settings: data ?? DEFAULTS,
    update:   mutation.mutate,
    isSaving: mutation.isPending,
    isError:  mutation.isError,
  };
};

/** 이 브라우저에 그 기능을 보여줄지 — 전체거나, 관리자만인데 이 브라우저가 관리자 인증됨 */
export const useVisible = (key: keyof VisibilitySettings): boolean => {
  const mode = useVisibilitySettings().settings[key];
  const adminAuthed = useUiStore(s => s.adminAuthed);
  return mode === 'all' || (mode === 'admin' && adminAuthed);
};
