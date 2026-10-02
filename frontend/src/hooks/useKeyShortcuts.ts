import { useEffect, useRef } from 'react';

/**
 * 전역 한 글자 단축키 — 키는 KeyboardEvent.code('KeyG' 등)로 받아 한글 자판 상태(ㅎ)에서도 같은 자리로 동작.
 * 브라우저 단축키를 건드리지 않게 다음 경우엔 아무것도 안 함(기본 동작도 막지 않음):
 * - Ctrl·Alt·Shift·Meta 중 하나라도 눌린 경우(Ctrl+F·Ctrl+W 등은 그대로 브라우저로)
 * - 입력칸(input·textarea·select·contenteditable)에 포커스가 있거나 한글 조합 중(isComposing)
 * - 키를 누르고 있어 반복 입력되는 경우
 * handlers는 매 렌더 최신 것을 쓰므로(ref) 호출부에서 useCallback으로 감쌀 필요 없음
 */
export const useKeyShortcuts = (handlers: Record<string, () => void>) => {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey || e.repeat || e.isComposing) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const fn = ref.current[e.code];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
};
