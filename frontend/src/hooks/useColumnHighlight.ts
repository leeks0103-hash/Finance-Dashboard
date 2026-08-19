import { useCallback, useState } from 'react';

/** 헤더 클릭 시 컬럼 전체를 하이라이트 — DataTable·KpiRawTable 공용 */
export const useColumnHighlight = () => {
  const [highlightedCol, setHighlightedCol] = useState<string | null>(null);

  // 항상 해당 컬럼으로 설정 (정렬 전환 시 꺼지지 않음)
  const setHighlight   = useCallback((columnId: string) => setHighlightedCol(columnId), []);
  const clearHighlight = useCallback(() => setHighlightedCol(null), []);

  return { highlightedCol, setHighlight, clearHighlight };
};
