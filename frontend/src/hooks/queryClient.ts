import { QueryClient } from '@tanstack/react-query';

/** React Query staleTime/gcTime 상수 — 훅 전반에서 공유 */
export const STALE_3MIN = 3 * 60_000;
export const STALE_5MIN = 5 * 60_000;
export const GC_10MIN   = 10 * 60_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_3MIN,
      gcTime:    GC_10MIN,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
