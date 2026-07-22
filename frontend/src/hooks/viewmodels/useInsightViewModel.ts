import { useInsights } from '@/hooks/useInsights';
import { useExpandableList } from '@/hooks/useExpandableList';
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
  toggleLabel:     string;
  toggleShowAll:   () => void;
  top:  InsightRowViewModel[];
  risk: InsightRowViewModel[];
}

const COMMENT_PREVIEW = 3;

export const useInsightViewModel = (): InsightViewModel => {
  const { data, isLoading } = useInsights();

  // 접기/펼치기 — useExpandableList로 분리
  const commentList = useExpandableList(data?.comments ?? [], COMMENT_PREVIEW);

  if (!data || isLoading) {
    return {
      isLoading, isEmpty: false, comments: [],
      hasMoreComments: false, toggleLabel: '', toggleShowAll: commentList.toggleShowAll,
      top: [], risk: [],
    };
  }

  const isEmpty = !data.comments.length && !data.top.length && !data.risk.length;

  return {
    isLoading,
    isEmpty,
    comments:        commentList.visible,
    hasMoreComments: commentList.hasMore,
    toggleLabel:     commentList.toggleLabel,
    toggleShowAll:   commentList.toggleShowAll,
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
