import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion as reducedMotion } from '@/utils/format';

const CLOSE_MS = 160;   // index.css .closingOverlay/.closingPanel 길이와 맞출 것

/**
 * 모달을 닫을 때 퇴장 애니메이션(index.css .closingOverlay/.closingPanel)을 먼저 보여주고 onClose 호출.
 * closing이 true인 동안 overlay/panel에 그 클래스를 붙이면 된다. 움직임 줄이기 설정이면 즉시 닫음.
 * 자체 퇴장 애니메이션을 쓰는 곳(ChartCard 등)은 ms에 그 길이를 넘긴다.
 */
export const useAnimatedClose = (onClose: () => void, ms = CLOSE_MS) => {
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
    }, ms);
  };

  return { closing, close };
};

const SWAP_OUT_MS = 180;   // index.css .swapOut 길이와 맞출 것

/**
 * 같은 자리에서 뷰를 바꿀 때(목록 ↔ 상세 등) — 기존 뷰가 페이드아웃(.swapOut)된 뒤 새 뷰로 교체.
 * shown = 지금 그릴 뷰, leaving = 퇴장 중(.swapOut 붙이기). 새 뷰는 key={shown} + .swapFadeIn으로 등장.
 * 퇴장 중 원래 뷰로 되돌리면 교체 없이 그대로 복귀. 움직임 줄이기 설정이면 즉시 교체.
 */
export const useSwapView = <V,>(view: V) => {
  const [shown, setShown] = useState(view);
  useEffect(() => {
    if (Object.is(view, shown)) return;
    if (reducedMotion()) { setShown(view); return; }
    const t = window.setTimeout(() => setShown(view), SWAP_OUT_MS);
    return () => window.clearTimeout(t);
  }, [view, shown]);
  return { shown, leaving: !Object.is(view, shown) };
};

/**
 * 표 페이지를 넘길 때 본문이 뚝 바뀌지 않게 — 페이지가 바뀌고 새 데이터가 도착한(조회 끝난) 순간
 * index.css .pageInA / .pageInB 를 번갈아 돌려줌(같은 애니메이션, 이름만 달라 클래스가 바뀔 때마다 다시 재생).
 * tbody에 붙이면 됨 — key로 다시 마운트하지 않으니 행 상태(펼침 등)는 그대로. 첫 렌더엔 안 붙음.
 */
export const usePageSwapClass = (page: number | string, isFetching = false) => {
  const [n, setN] = useState(0);
  const prev = useRef(page);
  const pending = useRef(false);
  // layout effect여야 함 — 일반 effect면 새 행이 한 번 그려진 뒤(2~3프레임) 클래스가 붙어 "보였다 → 사라졌다 → 등장"으로 번쩍임
  useLayoutEffect(() => {
    if (prev.current !== page) { prev.current = page; pending.current = true; }
    if (pending.current && !isFetching) { pending.current = false; setN(v => v + 1); }
  }, [page, isFetching]);
  return n === 0 ? '' : n % 2 ? 'pageInA' : 'pageInB';
};

/**
 * open 상태로 켜고 끄는 드롭다운용 — open이 false가 된 뒤에도 퇴장 애니메이션 동안(CLOSE_MS) 남겨둔다.
 * mounted면 렌더, closing이면 index.css .closingDrop 같은 퇴장 클래스를 붙이면 됨.
 * setOpen을 부르는 곳(바깥 클릭·항목 클릭 등)을 하나도 안 바꿔도 되는 게 장점.
 * 자체 퇴장 애니메이션을 쓰는 곳(설정 패널 등)은 ms에 그 길이를 넘긴다.
 */
export const usePresence = (open: boolean, ms = CLOSE_MS) => {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) { setMounted(true); return; }
    if (!mounted) return;
    if (reducedMotion()) { setMounted(false); return; }
    const t = window.setTimeout(() => setMounted(false), ms);
    return () => window.clearTimeout(t);
  }, [open, mounted, ms]);
  return { mounted: open || mounted, closing: !open && mounted };
};
