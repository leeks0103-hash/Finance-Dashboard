import { useSummary } from '@/hooks/useSummary';
import { formatBillion, formatRate } from '@/utils';

export type KpiAccent = 'brand' | 'profit' | 'loss' | 'warn';

export interface KpiViewModel {
  isLoading:      boolean;
  revenue:        string;
  expenditure:    string;
  profit:         string;
  profitAccent:   KpiAccent; // H-10: 손실 시 loss(빨강), 흑자 시 profit(초록)
  rate:           string;
}

export const useKpiViewModel = (): KpiViewModel => {
  const { data, isLoading } = useSummary();
  return {
    isLoading,
    revenue:      data ? formatBillion(data.total_revenue)     : '-',
    expenditure:  data ? formatBillion(data.total_expenditure) : '-',
    profit:       data ? formatBillion(data.total_profit)      : '-',
    profitAccent: data && data.total_profit < 0 ? 'loss' : 'profit',
    rate:         data ? formatRate(data.avg_profit_rate)      : '-',
  };
};
