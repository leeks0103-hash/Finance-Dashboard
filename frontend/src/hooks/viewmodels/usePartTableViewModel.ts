import { useMemo } from 'react';
import { useSummary } from '@/hooks/useSummary';
import { formatBillion, formatRate } from '@/utils';

export interface PartTableRow {
  part:            string;
  revenue:         string;
  expenditure:     string;
  directCost:      string;
  laborCost:       string;
  overhead:        string;
  operatingProfit: string;
  profitRate:      string;
  count:           number;
  isLoss:          boolean;
}

export interface PartTableViewModel {
  isLoading: boolean;
  rows:      PartTableRow[];
}

export const usePartTableViewModel = (): PartTableViewModel => {
  const { data, isLoading } = useSummary();

  const rows = useMemo((): PartTableRow[] => {
    if (!data?.by_part) return [];
    return Object.entries(data.by_part)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([part, s]) => ({
        part,
        revenue:         formatBillion(s.revenue),
        expenditure:     formatBillion(s.expenditure),
        directCost:      formatBillion(s.direct_cost ?? 0),
        laborCost:       formatBillion(s.labor_cost ?? 0),
        overhead:        formatBillion(s.overhead ?? 0),
        operatingProfit: formatBillion(s.profit),
        // 파트별 이익율(%) 차트와 동일 산식(가중평균: 이익/매출) — 개별 프로젝트 이익율 단순평균과
        // 다른 값이 되므로 반드시 이 방식으로 맞춰야 차트·표가 서로 다른 숫자를 보여주지 않음
        profitRate:      formatRate(s.revenue ? (s.profit / s.revenue) * 100 : 0),
        count:           s.count,
        isLoss:          s.profit < 0,
      }));
  }, [data?.by_part]);

  return { isLoading, rows };
};
