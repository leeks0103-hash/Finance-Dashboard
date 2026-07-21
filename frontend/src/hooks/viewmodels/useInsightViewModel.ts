import { useState, useCallback } from 'react';
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
  isLoading:       boolean;
  isEmpty:         boolean;
  comments:        Array<{ type: 'positive' | 'info' | 'neutral' | 'warning'; icon: string; text: string }>;
  hasMoreComments: boolean;
  toggleLabel:     string;   // '접기' | '더보기 +N' — JSX 삼항 제거
  toggleShowAll:   () => void;
  top:  InsightRowViewModel[];
  risk: InsightRowViewModel[];
}

const COMMENT_PREVIEW = 3;

export const useInsightViewModel = (): InsightViewModel => {
  const { data, isLoading } = useInsights();
  const [showAll, setShowAll] = useState(false);

  const toggleShowAll = useCallback(() => setShowAll(s => !s), []);

  if (!data || isLoading) {
    return {
      isLoading, isEmpty: false, comments: [],
      hasMoreComments: false, toggleLabel: '', toggleShowAll,
      top: [], risk: [],
    };
  }

  const isEmpty = !data.comments.length && !data.top.length && !data.risk.length;

  const allComments     = data.comments;
  const hasMoreComments = allComments.length > COMMENT_PREVIEW;
  const moreCount       = Math.max(0, allComments.length - COMMENT_PREVIEW);
  const visibleComments = showAll ? allComments : allComments.slice(0, COMMENT_PREVIEW);
  const toggleLabel     = showAll ? '접기' : `더보기 +${moreCount}`;

  return {
    isLoading,
    isEmpty,
    comments: visibleComments,
    hasMoreComments,
    toggleLabel,
    toggleShowAll,
    top: data.top.map((r, i) => ({
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
