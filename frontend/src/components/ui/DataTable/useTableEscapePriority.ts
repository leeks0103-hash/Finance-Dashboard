import { useEffect, useRef } from 'react';

interface EscapeHandler {
  /** true면 이 핸들러가 Esc를 처리 — 우선순위상 앞선 항목이 active면 뒤는 실행 안 됨 */
  active: boolean;
  run:    () => void;
}

/**
 * Esc 키 우선순위 처리 — 배열 앞쪽부터 active한 첫 핸들러만 실행하고 멈춤.
 * DataTable·KpiRawTable 공용: 팝업 닫기 > 컬럼 하이라이트 해제 > 검색 초기화 순.
 * handlers 배열은 매 렌더 새로 생성돼도 안전 — ref로 최신값만 읽고 리스너는 마운트 시 한 번만 등록.
 */
export const useTableEscapePriority = (handlers: EscapeHandler[]) => {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const handler = handlersRef.current.find(h => h.active);
      handler?.run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
};
