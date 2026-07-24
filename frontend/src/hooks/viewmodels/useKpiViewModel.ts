import { useSummary } from '@/hooks/useSummary';
import { useCountUp } from '@/hooks/useCountUp';
import { formatBillion, formatRate } from '@/utils';

export type KpiAccent = 'brand' | 'profit' | 'loss' | 'warn' | 'purple';

export interface KpiViewModel {
  isLoading:    boolean;
  revenue:      string;
  expenditure:  string;
  profit:       string;
  profitAccent: KpiAccent;
  rate:         string;
}

export const useKpiViewModel = (): KpiViewModel => {
  const { data, isLoading } = useSummary();

  const revenueRaw     = data?.total_revenue     ?? 0;
  const expenditureRaw = data?.total_expenditure ?? 0;
  const profitRaw      = data?.total_profit      ?? 0;
  const rateRaw        = data?.avg_profit_rate   ?? 0;

  const animRevenue     = useCountUp(revenueRaw);
  const animExpenditure = useCountUp(expenditureRaw);
  const animProfit      = useCountUp(profitRaw);
  const animRate        = useCountUp(rateRaw);

  return {
    isLoading,
    revenue:      isLoading ? '-' : formatBillion(animRevenue),
    expenditure:  isLoading ? '-' : formatBillion(animExpenditure),
    profit:       isLoading ? '-' : formatBillion(animProfit),
    profitAccent: data == null ? 'brand' : data.total_profit < 0 ? 'loss' : 'profit',
    rate:         isLoading ? '-' : formatRate(animRate),
  };
};
