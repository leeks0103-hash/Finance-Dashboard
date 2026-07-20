import { useProjects } from '@/hooks/useProjects';
import { formatBillion, formatRate } from '@/utils';
import type { Project } from '@/types';

export interface ProjectRowViewModel extends Project {
  revenueFormatted:         string;
  expenditureFormatted:     string;
  directCostFormatted:      string;
  laborCostFormatted:       string;
  overheadFormatted:        string;
  operatingProfitFormatted: string;
  profitRateFormatted:      string;
  isLoss:                   boolean;
}

export interface ProjectTableViewModel {
  isLoading: boolean;
  rows:      ProjectRowViewModel[];
}

export const useProjectTableViewModel = (): ProjectTableViewModel => {
  const { data = [], isLoading } = useProjects();

  return {
    isLoading,
    rows: data.map(r => ({
      ...r,
      revenueFormatted:         formatBillion(r.revenue),
      expenditureFormatted:     formatBillion(r.expenditure),
      directCostFormatted:      formatBillion(r.direct_cost),
      laborCostFormatted:       formatBillion(r.labor_cost),
      overheadFormatted:        formatBillion(r.overhead),
      operatingProfitFormatted: formatBillion(r.operating_profit),
      profitRateFormatted:      formatRate(r.profit_rate),
      isLoss:                   r.operating_profit < 0,
    })),
  };
};
