import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getFinanceAiAnalysis, getKpiAiAnalysis } from '@/api/ai.api';
import { GC_10MIN } from './queryClient';

// 서버가 원본 데이터 mtime 기준으로 이미 캐싱 — 클라이언트도 길게 잡아 같은 탭을 여러 번
// 열어도 매번 H-Chat을 다시 부르지 않음(재추출 전까지는 서버 캐시가 그대로 반환됨)
const AI_STALE_MS = 30 * 60_000;

export type AiTab = 'finance' | 'kpi';

const FETCHERS: Record<AiTab, (force?: boolean) => ReturnType<typeof getFinanceAiAnalysis>> = {
  finance: getFinanceAiAnalysis,
  kpi:     getKpiAiAnalysis,
};

/**
 * 경영실적/재무데이터·KPI 탭 공용 AI 분석 훅 — 탭에 따라 다른 API를 호출.
 * enabled=false면 쿼리를 아예 안 보냄 — 위젯이 관련 없는 탭(만족도 등)에서도
 * 훅 호출 순서를 안 깨뜨리려고(rules-of-hooks) 항상 호출은 하되 이걸로 끔.
 */
export const useAiAnalysis = (tab: AiTab, enabled = true) => {
  const qc = useQueryClient();
  const queryKey = ['ai-analysis', tab];

  const query = useQuery({
    queryKey,
    queryFn:   () => FETCHERS[tab](),
    staleTime: AI_STALE_MS,
    gcTime:    GC_10MIN,
    retry:     0,
    enabled,
    meta: { queryType: 'ai-analysis' },
  });

  const refresh = useMutation({
    mutationFn: () => FETCHERS[tab](true),
    onSuccess:  (data) => qc.setQueryData(queryKey, data),
  });

  return {
    text:        query.data?.text ?? '',
    generatedAt: query.data?.generated_at ?? null,
    isLoading:   query.isLoading,
    isError:     query.isError,
    error:       query.error as Error | null,
    refresh:     () => refresh.mutate(),
    isRefreshing: refresh.isPending,
  };
};
