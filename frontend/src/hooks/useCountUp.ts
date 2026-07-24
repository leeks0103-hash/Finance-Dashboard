import { useEffect, useRef, useState } from 'react';

export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isFinite(target) || target === 0) { setValue(0); return; }
    cancelAnimationFrame(rafRef.current);
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 3; // easeOutCubic
      setValue(target * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else setValue(target);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}
