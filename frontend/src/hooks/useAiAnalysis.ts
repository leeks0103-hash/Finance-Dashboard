import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getFinanceAiAnalysis, getKpiAiAnalysis } from '@/api/ai.api';
import { toast } from '@/utils';
import { GC_10MIN } from './queryClient';

// 서버가 원본 데이터 mtime 기준으로 이미 캐싱 — 클라이언트도 길게 잡아 같은 탭을 여러 번
// 열어도 매번 H-Chat을 다시 부르지 않음(재추출 전까지는 서버 캐시가 그대로 반환됨)
const AI_STALE_MS = 30 * 60_000;

export type AiTab = 'finance' | 'kpi';

const DONE_LABEL: Record<AiTab, string> = {
  finance: '경영실적 인사이트',
  kpi:     'KPI 현황 인사이트',
};

// 서버 캐시(원본 mtime 동일)에 걸리면 즉시 돌아오므로, 이보다 빨리 끝난 최초 조회는 "분석"이
// 아니라 저장된 결과를 받아온 것 — 완료 토스트 생략
const TOAST_MIN_MS = 1_500;

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
    // 토스트는 컴포넌트가 아니라 여기(queryFn/mutation 콜백)에서 — 위젯이 탭 전환으로 언마운트된
    // 뒤에 끝나도 알림이 뜨도록(queryFn·mutation 옵션 콜백은 언마운트와 무관하게 실행됨)
    queryFn:   async () => {
      const started = Date.now();
      try {
        const data = await FETCHERS[tab]();
        if (Date.now() - started >= TOAST_MIN_MS) toast(`${DONE_LABEL[tab]} 분석이 완료됐습니다`);
        return data;
      } catch (e) {
        toast(`${DONE_LABEL[tab]} 분석에 실패했습니다`, { error: true });
        throw e;
      }
    },
    staleTime: AI_STALE_MS,
    gcTime:    GC_10MIN,
    retry:     0,
    enabled,
    meta: { queryType: 'ai-analysis' },
  });

  // "다시 분석" 진행 여부는 useMutation의 isPending(이 컴포넌트 인스턴스 한정)이 아니라
  // mutationKey로 전역 MutationCache에서 읽는다 — 위젯이 Navbar ActionBar 안에 있어 탭 전환 시
  // 언마운트되는데, isPending을 쓰면 재마운트된 위젯은 진행 중인 걸 몰라 옛 결과를 보여줘서
  // "다시 분석이 취소된" 것처럼 보였음(2026-09-28). 요청 자체와 onSuccess(setQueryData)는
  // 언마운트와 무관하게 끝까지 실행됨
  const mutationKey = ['ai-analysis-refresh', tab];
  const refresh = useMutation({
    mutationKey,
    mutationFn: () => FETCHERS[tab](true),
    onSuccess:  (data) => {
      qc.setQueryData(queryKey, data);
      toast(`${DONE_LABEL[tab]} 분석이 완료됐습니다`);
    },
    onError:    () => toast(`${DONE_LABEL[tab]} 분석에 실패했습니다`, { error: true }),
  });
  const refreshingCount = useIsMutating({ mutationKey });

  return {
    text:        query.data?.text ?? '',
    generatedAt: query.data?.generated_at ?? null,
    isLoading:   query.isLoading,
    isError:     query.isError,
    error:       query.error as Error | null,
    refresh:     () => refresh.mutate(),
    isRefreshing: refreshingCount > 0,
  };
};
