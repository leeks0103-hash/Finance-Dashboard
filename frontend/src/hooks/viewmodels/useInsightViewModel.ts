import { useInsights } from '@/hooks/useInsights';
import { formatRate } from '@/utils';

export interface InsightRowViewModel {
  projectCode: string;
  part:        string;
  value:       string;
  valueColor:  string;
}

export interface InsightViewModel {
  isLoading: boolean;
  isEmpty:   boolean;
  comments:  Array<{ type: 'positive' | 'info' | 'neutral' | 'warning'; icon: string; text: string }>;
  top:  InsightRowViewModel[];
  risk: InsightRowViewModel[];
}

export const useInsightViewModel = (): InsightViewModel => {
  const { data, isLoading } = useInsights();

  if (!data || isLoading) {
    return { isLoading, isEmpty: true, comments: [], top: [], risk: [] };
  }

  const isEmpty = !data.comments.length && !data.top.length;

  return {
    isLoading,
    isEmpty,
    comments: data.comments,
    top: data.top.map(r => ({
      projectCode: r.project_code,
      part:        r.part,
      value:       formatRate(r.profit_rate),
      valueColor:  'var(--profit)',
    })),
    risk: data.risk.map(r => ({
      projectCode: r.project_code,
      part:        r.part,
      value:       r.operating_profit < 0 ? '손실' : formatRate(r.profit_rate),
      valueColor:  r.operating_profit < 0 ? 'var(--loss)' : 'var(--warn)',
    })),
  };
};
