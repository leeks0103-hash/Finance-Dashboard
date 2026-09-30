import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion as reducedMotion } from '@/utils/format';

const CLOSE_MS = 160;   // index.css .closingOverlay/.closingPanel 길이와 맞출 것

/**
 * 모달을 닫을 때 퇴장 애니메이션(index.css .closingOverlay/.closingPanel)을 먼저 보여주고 onClose 호출.
 * closing이 true인 동안 overlay/panel에 그 클래스를 붙이면 된다. 움직임 줄이기 설정이면 즉시 닫음.
 */
export const useAnimatedClose = (onClose: () => void) => {
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const cb = useRef(onClose);
  cb.current = onClose;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const close = () => {
    if (closing) return;
    if (reducedMotion()) { cb.current(); return; }
    setClosing(true);
    timer.current = window.setTimeout(() => {
      setClosing(false);
      cb.current();
    }, CLOSE_MS);
  };

  return { closing, close };
};

/**
 * open 상태로 켜고 끄는 드롭다운용 — open이 false가 된 뒤에도 퇴장 애니메이션 동안(CLOSE_MS) 남겨둔다.
 * mounted면 렌더, closing이면 index.css .closingDrop 같은 퇴장 클래스를 붙이면 됨.
 * setOpen을 부르는 곳(바깥 클릭·항목 클릭 등)을 하나도 안 바꿔도 되는 게 장점.
 */
export const usePresence = (open: boolean) => {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) { setMounted(true); return; }
    if (!mounted) return;
    if (reducedMotion()) { setMounted(false); return; }
    const t = window.setTimeout(() => setMounted(false), CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);
  return { mounted: open || mounted, closing: !open && mounted };
};
