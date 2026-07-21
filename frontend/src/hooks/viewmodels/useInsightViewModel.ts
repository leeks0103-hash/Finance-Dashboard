import { useState } from 'react';
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
  isLoading:       boolean;
  isEmpty:         boolean;
  comments:        Array<{ type: 'positive' | 'info' | 'neutral' | 'warning'; icon: string; text: string }>;
  hasMoreComments: boolean;
  moreCount:       number;
  showAll:         boolean;
  toggleShowAll:   () => void;
  top:  InsightRowViewModel[];
  risk: InsightRowViewModel[];
}

const COMMENT_PREVIEW = 3;

export const useInsightViewModel = (): InsightViewModel => {
  const { data, isLoading } = useInsights();
  const [showAll, setShowAll] = useState(false);

  const toggleShowAll = () => setShowAll(s => !s);

  if (!data || isLoading) {
    return { isLoading, isEmpty: false, comments: [], hasMoreComments: false, moreCount: 0, showAll, toggleShowAll, top: [], risk: [] };
  }

  // risk 배열도 포함해야 리스크만 있는 필터에서 EmptyState 오표시 방지
  const isEmpty = !data.comments.length && !data.top.length && !data.risk.length;

  const allComments    = data.comments;
  const hasMoreComments = allComments.length > COMMENT_PREVIEW;
  const moreCount       = Math.max(0, allComments.length - COMMENT_PREVIEW);
  const visibleComments = showAll ? allComments : allComments.slice(0, COMMENT_PREVIEW);

  return {
    isLoading,
    isEmpty,
    comments: visibleComments,
    hasMoreComments,
    moreCount,
    showAll,
    toggleShowAll,
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
