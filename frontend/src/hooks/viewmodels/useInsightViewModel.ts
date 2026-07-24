import { useInsights } from '@/hooks/useInsights';
import { formatRate } from '@/utils';

export interface InsightRowViewModel {
  projectCode: string;
  displayCode: string;
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

/** 임시·미정 코드 제외 */
const isValid = (code: string): boolean => {
  const c = code.trim();
  if (!c || c === '0') return false;
  if (/^\d+$/.test(c)) return false;
  if (/예정|미정|생성|추진|신규/.test(c)) return false;
  return true;
};

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
    top: data.top.filter(r => isValid(r.project_code)).slice(0, 5).map((r, i) => ({
      projectCode: `${r.project_code}-${r.stage ?? i}`,
      displayCode: shortCode(r.project_code),
      part:        r.part,
      value:       formatRate(r.profit_rate),
      valueColor:  'var(--profit)',
    })),
    risk: data.risk.filter(r => isValid(r.project_code)).slice(0, 5).map((r, i) => ({
      projectCode: `${r.project_code}-${r.stage ?? i}`,
      displayCode: shortCode(r.project_code),
      part:        r.part,
      value:       r.operating_profit < 0 ? '손실' : formatRate(r.profit_rate),
      valueColor:  r.operating_profit < 0 ? 'var(--loss)' : 'var(--warn)',
    })),
  };
};
