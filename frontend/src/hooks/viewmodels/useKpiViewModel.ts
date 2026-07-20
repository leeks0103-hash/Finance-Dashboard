import { useSummary } from '@/hooks/useSummary';
import { formatBillion, formatRate } from '@/utils';

export interface KpiViewModel {
  isLoading: boolean;
  revenue:     string;
  expenditure: string;
  profit:      string;
  rate:        string;
}

export const useKpiViewModel = (): KpiViewModel => {
  const { data, isLoading } = useSummary();
  return {
    isLoading,
    revenue:     data ? formatBillion(data.total_revenue)     : '-',
    expenditure: data ? formatBillion(data.total_expenditure) : '-',
    profit:      data ? formatBillion(data.total_profit)      : '-',
    rate:        data ? formatRate(data.avg_profit_rate)      : '-',
  };
};
