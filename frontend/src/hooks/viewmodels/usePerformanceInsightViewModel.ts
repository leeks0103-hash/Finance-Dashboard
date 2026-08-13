import { usePerformanceInsights } from '@/hooks/usePerformanceInsights';
import { formatEok } from '@/utils';

export interface PerfInsightRowViewModel {
  key:         string;
  displayCode: string;
  part:        string;
  value:       string;
  valueColor:  string;
  subValue:    string;
}

export interface PerformanceInsightViewModel {
  isLoading: boolean;
  isEmpty:   boolean;
  comments:  Array<{ type: 'positive' | 'info' | 'neutral' | 'warning'; icon: string; text: string }>;
  worst: PerfInsightRowViewModel[];
  risk:  PerfInsightRowViewModel[];
}

/** 화면에 표시할 짧은 코드 */
const shortCode = (code: string): string =>
  code.length <= 16 ? code : code.slice(0, 14) + '…';

export const usePerformanceInsightViewModel = (): PerformanceInsightViewModel => {
  const { data, isLoading } = usePerformanceInsights();

  if (!data || isLoading) {
    return { isLoading, isEmpty: false, comments: [], worst: [], risk: [] };
  }

  const isEmpty = !data.comments.length && !data.worst.length && !data.risk.length;

  return {
    isLoading,
    isEmpty,
    comments: data.comments,
    worst: data.worst.map((r, i) => ({
      key:         `${r.project_code}-${i}`,
      displayCode: shortCode(r.project_code),
      part:        r.part,
      value:       `${r.achieve_rate}%`,
      valueColor:  r.achieve_rate < 70 ? 'var(--loss)' : 'var(--warn)',
      subValue:    `${formatEok(r.jun_actual)} / ${formatEok(r.plan_initial)}`,
    })),
    risk: data.risk.map((r, i) => ({
      key:         `${r.project_code}-${i}`,
      displayCode: shortCode(r.project_code),
      part:        r.part,
      value:       r.operating_profit < 0 ? '손실' : `${r.profit_rate}%`,
      valueColor:  r.operating_profit < 0 ? 'var(--loss)' : 'var(--warn)',
      subValue:    r.operating_profit < 0
        ? `손실 ${formatEok(Math.abs(r.operating_profit))}`
        : formatEok(r.operating_profit),
    })),
  };
};
