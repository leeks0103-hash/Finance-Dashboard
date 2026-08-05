import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './MultiSelectDropdown.module.css';

export interface MultiSelectDropdownProps {
  label:    string;
  options:  string[];
  selected: string[];
  onToggle: (value: string) => void;
  onReset?: () => void;
  onHover?: (value: string) => void;
}

const MultiSelectDropdown = ({
  label,
  options,
  selected,
  onToggle,
  onReset,
  onHover,
}: MultiSelectDropdownProps) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const count = selected.length;
  const allSelected = count === 0;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${count > 0 ? styles.active : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <span className={styles.triggerLabel}>{label}</span>
        {count > 0 && <span className={styles.badge}>{count}</span>}
        <span className={`${styles.arrow} ${open ? styles.arrowOpen : ''}`}>▾</span>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <label className={styles.item}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={allSelected}
              onChange={() => onReset?.()}
              readOnly={!onReset}
            />
            <span className={styles.itemLabel}>전체</span>
          </label>
          <div className={styles.divider} />
          {options.map(opt => (
            <label
              key={opt}
              className={styles.item}
              onMouseEnter={() => onHover?.(opt)}
            >
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={selected.includes(opt)}
                onChange={() => onToggle(opt)}
              />
              <span className={styles.itemLabel}>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
