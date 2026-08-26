import { useState, useRef, useEffect, type ReactNode } from 'react';
import styles from './InfoButton.module.css';

interface Props {
  children: ReactNode;
}

export const InfoButton = ({ children }: Props) => {
  const [open, setOpen] = useState(false);
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
      <button
        className={styles.btn}
        onClick={() => setOpen(v => !v)}
        aria-label="데이터 기준 설명"
        type="button"
      >
        i
      </button>
      {open && (
        <div className={styles.popover}>
          <div className={styles.content}>{children}</div>
        </div>
      )}
    </div>
  );
};

export default InfoButton;

