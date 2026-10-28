import { useSummary } from '@/hooks/useSummary';

export interface FinancePageViewModel {
  /** 상단 필터를 바꿔 요약(카드·차트·파트 표)을 다시 불러오는 중 — 첫 로딩은 스켈레톤이 맡으므로 제외 */
  isRefreshing: boolean;
}

/**
 * 재무 탭 페이지 단위 상태. 필터 변경은 keepPreviousData라 이전 값이 그대로 남아 있어
 * 불러오는 중인지 알 길이 없었음(2026-10-28) → 스피너·흐림을 띄우는 신호.
 * 같은 쿼리(['summary', filters])라 섹션들이 쓰는 useSummary와 캐시를 공유 — 추가 요청 없음.
 */
export const useFinancePageViewModel = (): FinancePageViewModel => {
  const { isFetching, isLoading } = useSummary();
  return { isRefreshing: isFetching && !isLoading };
};
