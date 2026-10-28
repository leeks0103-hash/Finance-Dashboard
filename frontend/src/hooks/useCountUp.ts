import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/utils/format';

/**
 * 숫자가 바뀔 때 **지금 보이는 값에서 새 값으로** 부드럽게 이어 감(easeOutCubic).
 * 예전엔 매번 0에서 다시 올라가 필터를 바꿀 때마다 숫자가 0으로 떨어졌다가 올라왔음(2026-10-28 개선).
 * 첫 렌더만 0에서 시작. 애니메이션 도중에 목표가 또 바뀌면 그 순간의 값에서 이어 감.
 * OS "움직임 줄이기"가 켜져 있으면 즉시 목표 값. 마지막 프레임은 항상 정확히 target.
 */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);       // 마지막으로 화면에 보인 값 — 다음 애니메이션의 시작점
  const rafRef = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    if (!isFinite(target)) { fromRef.current = 0; setValue(0); return; }
    if (duration <= 0 || prefersReducedMotion() || fromRef.current === target) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 3; // easeOutCubic
      if (t < 1) {
        const v = from + (target - from) * eased;
        fromRef.current = v;
        setValue(v);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
        setValue(target);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}
