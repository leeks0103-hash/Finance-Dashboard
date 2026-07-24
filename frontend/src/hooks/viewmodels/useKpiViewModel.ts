import { useSummary } from '@/hooks/useSummary';
import { useCountUp } from '@/hooks/useCountUp';
import { formatBillion, formatRate } from '@/utils';
import type { KpiAccent } from '@/types';

export interface KpiCardData {
  label:   string;
  value:   string;
  accent:  KpiAccent;
  trend:   string | null;
  trendUp: boolean;
}

export interface KpiViewModel {
  isLoading: boolean;
  isError:   boolean;
  cards:     KpiCardData[];
}

export const useKpiViewModel = (): KpiViewModel => {
  const { data, isLoading, isError } = useSummary();

  const revenueRaw     = data?.total_revenue     ?? 0;
  const expenditureRaw = data?.total_expenditure ?? 0;
  const profitRaw      = data?.total_profit      ?? 0;
  const rateRaw        = data?.avg_profit_rate   ?? 0;

  const animRevenue     = useCountUp(revenueRaw);
  const animExpenditure = useCountUp(expenditureRaw);
  const animProfit      = useCountUp(profitRaw);
  const animRate        = useCountUp(rateRaw);

  if (isLoading || !data) return { isLoading, isError: !!isError, cards: [] };

  // 비율 계산 — 매출 0일 때 오표시 방지
  const hasSales     = revenueRaw > 0;  // 양수 매출만 비율 계산 (음수 매출 시 비율 부호 반전 방지)
  // animExpenditure 사용 → value의 카운트업과 지출률 배지가 동기화됨
  const expenseRatio = hasSales ? (animExpenditure / revenueRaw) * 100 : null;

  const cards: KpiCardData[] = [
    {
      label:   '총매출',
      value:   formatBillion(animRevenue),
      accent:  'brand',
      // animRate 사용 → value의 카운트업과 배지 숫자가 동기화됨
      trend:   `이익율 ${formatRate(animRate)}`,
      trendUp: rateRaw > 0,  // 0은 손익분기 — ▲ 표시 안 함
    },
    {
      label:   '지출합계',
      value:   formatBillion(animExpenditure),
      accent:  'warn',
      trend:   expenseRatio != null ? `지출률 ${expenseRatio.toFixed(1)}%` : null,
      trendUp: expenseRatio != null ? expenseRatio < 80 : false,
    },
    {
      label:   '경상이익',
      value:   formatBillion(animProfit),
      accent:  data.total_profit < 0 ? 'loss' : 'profit',
      // animProfit 사용 → value의 카운트업과 trend 배지 비율이 동기화됨
      trend:   hasSales ? `${((animProfit / revenueRaw) * 100).toFixed(1)}%` : null,
      trendUp: data.total_profit > 0,
    },
    {
      label:   '평균 이익율',
      value:   formatRate(animRate),
      accent:  'purple',
      trend:   null,
      trendUp: rateRaw > 0,  // 0은 손익분기 — 하향 스파크라인으로 표시
    },
  ];

  return { isLoading, isError: !!isError, cards };
};
