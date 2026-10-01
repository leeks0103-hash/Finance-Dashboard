import { useMemo } from 'react';
import { usePerformanceSummary } from './usePerformanceSummary';
import { PERF_YEAR, PERF_MONTH, perfActualRange } from '@/utils/perfPeriod';

export interface PerfPeriod {
  /** 기준월 숫자(1~12) — 이 달까지 실적, 다음 달부터 추정 */
  monthNum:    number;
  /** "8월" */
  month:       string;
  /** "2026년" */
  year:        string;
  /** "BI~BP (1~8월 점검열 합계)" — ⓘ 설명용 */
  actualRange: string;
}

/**
 * 실적현황 기준 시점 — 백엔드가 실제로 읽은 시트(summary.base)를 따름.
 * 응답 전·옛 서버(base 없음)면 "오늘 - 1개월" 폴백(utils/perfPeriod 상수).
 */
export const usePerfPeriod = (): PerfPeriod => {
  const { data } = usePerformanceSummary();
  const base = data?.base;
  return useMemo(() => {
    const monthNum = base?.month ?? parseInt(PERF_MONTH, 10);
    return {
      monthNum,
      month:       `${monthNum}월`,
      year:        base?.year ? `${base.year}년` : PERF_YEAR,
      actualRange: perfActualRange(monthNum),
    };
  }, [base?.month, base?.year]);
};
