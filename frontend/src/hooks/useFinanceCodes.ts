import { useQuery } from '@tanstack/react-query';
import { getFinanceCodes, type FinanceCodesResponse } from '@/api/finance.api';
import { STALE_5MIN, GC_10MIN } from './queryClient';

const useFinanceCodesQuery = <T,>(select: (d: FinanceCodesResponse) => T) =>
  useQuery({
    queryKey:          ['finance-codes'],
    queryFn:           getFinanceCodes,
    select,
    structuralSharing: true,
    staleTime:         STALE_5MIN,
    gcTime:            GC_10MIN,
    retry:             1,
    meta: { queryType: 'finance-codes' },
  });

const selectCodes     = (d: FinanceCodesResponse) => d.codes;
const selectCompleted = (d: FinanceCodesResponse) => d.completed ?? {};

/**
 * 재무 PPT 이력이 있는 프로젝트코드 → 건수 맵.
 * 실적현황 표에서 "이 행은 더블클릭하면 재무 이력(2뎁스)이 나온다"를 배지로 미리 알려주는 용도.
 * 코드↔건수만 담은 가벼운 응답이라 필터와 무관하게 한 번만 받아 캐시한다.
 */
export const useFinanceCodes = () => useFinanceCodesQuery(selectCodes);

/** 그중 "완료" 단계 보고가 있는 코드 → 건수 — 같은 요청을 공유(select만 다름). 검색 시 2뎁스 자동 펼침 판단용 */
export const useFinanceCompletedCodes = () => useFinanceCodesQuery(selectCompleted);
