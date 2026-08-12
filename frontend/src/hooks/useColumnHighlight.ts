import { useCallback, useState } from 'react';

/** 헤더 클릭 시 컬럼 전체를 하이라이트 — DataTable·KpiRawTable 공용 */
export const useColumnHighlight = () => {
  const [highlightedCol, setHighlightedCol] = useState<string | null>(null);

  const toggleHighlight = useCallback((columnId: string) => {
    setHighlightedCol(prev => prev === columnId ? null : columnId);
  }, []);

  const clearHighlight = useCallback(() => setHighlightedCol(null), []);

  return { highlightedCol, toggleHighlight, clearHighlight };
};
