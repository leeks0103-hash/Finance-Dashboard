import { useInsights } from '@/hooks/useInsights';
import { formatRate } from '@/utils';

export interface InsightRowViewModel {
  projectCode: string; // 고유 key (복합)
  displayCode: string; // 화면 표시용 원본 코드
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
    top: data.top.map((r, i) => ({
      // M-28: 동일 project_code가 복수 stage에 있을 수 있으므로 복합 키
      projectCode: `${r.project_code}-${r.stage ?? i}`,
      displayCode: r.project_code,
      part:        r.part,
      value:       formatRate(r.profit_rate),
      valueColor:  'var(--profit)',
    })),
    risk: data.risk.map((r, i) => ({
      projectCode: `${r.project_code}-${r.stage ?? i}`,
      displayCode: r.project_code,
      part:        r.part,
      value:       r.operating_profit < 0 ? '손실' : formatRate(r.profit_rate),
      valueColor:  r.operating_profit < 0 ? 'var(--loss)' : 'var(--warn)',
    })),
  };
};
