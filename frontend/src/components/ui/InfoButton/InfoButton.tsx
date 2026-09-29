import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { usePresence } from '@/components/ui/useAnimatedClose';
import styles from './InfoButton.module.css';

interface Props {
  children: ReactNode;
}

export const InfoButton = ({ children }: Props) => {
  const [open, setOpen] = useState(false);
  const pop = usePresence(open);   // 닫힐 때도 퇴장 애니메이션(.closingDrop)
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={wrapRef} className={styles.wrap}>
      <Button
        unstyled
        className={styles.btn}
        onClick={() => setOpen(v => !v)}
        aria-label="데이터 기준 설명"
        type="button"
      >
        i
      </Button>
      {pop.mounted && (
        <div className={`${styles.popover} ${pop.closing ? 'closingDrop' : ''}`}>
          <div className={styles.content}>{children}</div>
        </div>
      )}
    </div>
  );
};

export default InfoButton;

