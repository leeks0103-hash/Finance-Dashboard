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
  refetch:   () => void;
  cards:     KpiCardData[];
}

/**
 * 재무 탭 상단 KPI 카드 4개.
 * 파생값(지출률·실질 이익율·파트 이익율 편차)은 전부 /api/summary 가 계산해서 내려준다 —
 * 여기서는 애니메이션 카운트업과 포맷팅만 한다. (frontend-no-calc-logic)
 */
export const useKpiViewModel = (): KpiViewModel => {
  const { data, isLoading, isError, refetch } = useSummary();

  const revenueRaw     = data?.total_revenue     ?? 0;
  const expenditureRaw = data?.total_expenditure ?? 0;
  const profitRaw      = data?.total_profit      ?? 0;
  const rateRaw        = data?.avg_profit_rate   ?? 0;

  const animRevenue     = useCountUp(revenueRaw);
  const animExpenditure = useCountUp(expenditureRaw);
  const animProfit      = useCountUp(profitRaw);
  const animRate        = useCountUp(rateRaw);

  const base = { isLoading, isError: !!isError, refetch };

  if (isLoading || !data) return { ...base, cards: [] };

  const expenseRatio = data.expense_ratio ?? null;   // 지출률(%) — 백엔드 계산
  const profitRatio  = data.profit_ratio ?? null;    // 실질 이익율(%) — 백엔드 계산

  const cards: KpiCardData[] = [
    {
      label:   '총매출',
      value:   formatBillion(animRevenue),
      accent:  'brand',
      trend:   `이익율 ${formatRate(animRate)}`,
      trendUp: rateRaw > 0,  // 0은 손익분기 — ▲ 표시 안 함
    },
    {
      label:   '지출합계',
      value:   formatBillion(animExpenditure),
      accent:  'warn',
      trend:   expenseRatio != null ? `지출률 ${expenseRatio}%` : null,
      trendUp: expenseRatio != null ? expenseRatio < 80 : false,
    },
    {
      label:   '경상이익',
      value:   formatBillion(animProfit),
      accent:  data.total_profit < 0 ? 'loss' : 'profit',
      trend:   profitRatio != null ? `${profitRatio}%` : null,
      trendUp: data.total_profit > 0,
    },
    {
      label:   '평균 이익율',
      value:   formatRate(animRate),
      accent:  'purple',
      trend:   data.avg_rate_trend ?? null,
      trendUp: rateRaw > 0,  // 0은 손익분기 — 하향 스파크라인으로 표시
    },
  ];

  return { ...base, cards };
};
