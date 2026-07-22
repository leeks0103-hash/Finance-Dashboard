import { useState, useCallback } from 'react';

export interface ExpandableList<T> {
  visible:     T[];
  hasMore:     boolean;
  moreCount:   number;
  showAll:     boolean;
  toggleShowAll: () => void;
  toggleLabel: string;
}

/** 긴 리스트를 previewCount개만 먼저 보여주고 접기/펼치기를 제공하는 범용 훅 */
export const useExpandableList = <T>(items: T[], previewCount: number): ExpandableList<T> => {
  const [showAll, setShowAll] = useState(false);
  const toggleShowAll = useCallback(() => setShowAll(s => !s), []);

  const moreCount = Math.max(0, items.length - previewCount);
  const hasMore   = moreCount > 0;

  return {
    visible:     showAll ? items : items.slice(0, previewCount),
    hasMore,
    moreCount,
    showAll,
    toggleShowAll,
    toggleLabel: showAll ? '접기' : `더보기 +${moreCount}`,
  };
};
