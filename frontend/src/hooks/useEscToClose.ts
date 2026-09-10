import { useEffect, useRef } from 'react';

// 열려있는 모달들의 닫기 콜백 스택 — ESC는 항상 '맨 위(마지막에 연)' 모달 하나만 닫는다.
// (모달을 겹쳐 열었을 때 ESC 한 번에 전부 닫히던 문제 방지)
const stack: Array<() => void> = [];
let bound = false;

const onKey = (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || stack.length === 0) return;
  e.stopPropagation();
  stack[stack.length - 1]();
};

/**
 * ESC로 이 모달을 닫는다. 여러 모달이 겹쳐 있으면 가장 최근에 활성화된 것만 반응한다.
 * @param onClose 닫기 콜백 (매 렌더 새 함수여도 됨 — ref로 최신값 참조)
 * @param active  이 모달이 열려있는 동안만 true (기본 true)
 */
export const useEscToClose = (onClose: () => void, active = true) => {
  const cb = useRef(onClose);
  cb.current = onClose;

  useEffect(() => {
    if (!active) return;
    const entry = () => cb.current();
    stack.push(entry);
    if (!bound) {
      document.addEventListener('keydown', onKey);
      bound = true;
    }
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
};
