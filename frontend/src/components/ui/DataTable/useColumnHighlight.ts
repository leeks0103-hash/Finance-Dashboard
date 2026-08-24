import { useCallback, useEffect, useState, type RefObject } from 'react';

/**
 * 헤더 클릭 시 컬럼 전체를 하이라이트 — DataTable·KpiRawTable 공용.
 * containerRef를 넘기면 테이블 바깥 클릭 시 자동으로 하이라이트 해제.
 */
export const useColumnHighlight = (containerRef?: RefObject<HTMLElement | null>) => {
  const [highlightedCol, setHighlightedCol] = useState<string | null>(null);

  // 항상 해당 컬럼으로 설정 (정렬 전환 시 꺼지지 않음)
  const setHighlight   = useCallback((columnId: string) => setHighlightedCol(columnId), []);
  const clearHighlight = useCallback(() => setHighlightedCol(null), []);

  useEffect(() => {
    if (!highlightedCol || !containerRef) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setHighlightedCol(null);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [highlightedCol, containerRef]);

  return { highlightedCol, setHighlight, clearHighlight };
};
