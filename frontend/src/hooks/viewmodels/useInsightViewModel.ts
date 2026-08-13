import { useInsights } from '@/hooks/useInsights';
import { formatRate, formatBillion } from '@/utils';

export interface InsightRowViewModel {
  projectCode: string;
  displayCode: string;
  part:        string;
  value:       string;
  valueColor:  string;
  subValue:    string;
}

export interface InsightViewModel {
  isLoading: boolean;
  isEmpty:   boolean;
  comments:  Array<{ type: 'positive' | 'info' | 'neutral' | 'warning'; icon: string; text: string }>;
  top:  InsightRowViewModel[];
  risk: InsightRowViewModel[];
}

/** 화면에 표시할 짧은 코드 */
const shortCode = (code: string): string =>
  code.length <= 16 ? code : code.slice(0, 14) + '…';

export const useInsightViewModel = (): InsightViewModel => {
  const { data, isLoading } = useInsights();

  if (!data || isLoading) {
    return { isLoading, isEmpty: false, comments: [], top: [], risk: [] };
  }

  const isEmpty = !data.comments.length && !data.top.length && !data.risk.length;

  return {
    isLoading,
    isEmpty,
    comments: data.comments,
    top: data.top.slice(0, 10).map((r, i) => ({
      projectCode: `${r.project_code}-${r.stage ?? i}`,
      displayCode: shortCode(r.project_code),
      part:        r.part,
      value:       formatRate(r.profit_rate),
      valueColor:  'var(--profit)',
      subValue:    formatBillion(r.revenue),
    })),
    risk: data.risk.slice(0, 10).map((r, i) => ({
      projectCode: `${r.project_code}-${r.stage ?? i}`,
      displayCode: shortCode(r.project_code),
      part:        r.part,
      value:       r.operating_profit < 0 ? '손실' : formatRate(r.profit_rate),
      valueColor:  r.operating_profit < 0 ? 'var(--loss)' : 'var(--warn)',
      subValue:    r.operating_profit < 0
        ? `손실 ${formatBillion(Math.abs(r.operating_profit))}`
        : formatBillion(r.revenue),
    })),
  };
};
