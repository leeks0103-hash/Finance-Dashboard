import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './FilterChip.module.css';

interface Props {
  label:    string;
  checked:  boolean;
  onChange: () => void;
  onHover?: () => void;
}

const CLICK_WINDOW_MS = 400;

const FilterChip = ({ label, checked, onChange, onHover }: Props) => {
  // 선택 팝(.settle)은 "이 칩을 직접 눌러서" 켜졌을 때만 — 색만 바뀌어야 하는 경우엔 크기를 안 건드림.
  // · 예전엔 .checked에 애니메이션이 붙어 있어 첫 접속 때(옵션 로드·기본 전체 선택) 모든 칩이 줄었다 커졌음
  // · 다른 칩을 눌러 같이 켜지는 칩(팀 → 소속 파트, 파트 → 팀, "전체" → 나머지)도 크기가 들썩여서 제외(2026-09-30)
  const [settle, setSettle] = useState(false);
  const prev = useRef(checked);
  const clickedAt = useRef(-Infinity);
  useEffect(() => {
    if (prev.current === checked) return;
    prev.current = checked;
    setSettle(checked && performance.now() - clickedAt.current < CLICK_WINDOW_MS);
  }, [checked]);

  return (
    <Button
      unstyled
      className={`${styles.chip} ${checked ? styles.checked : ''} ${settle ? styles.settle : ''}`}
      onClick={() => { clickedAt.current = performance.now(); onChange(); }}
      onMouseEnter={onHover}
      aria-pressed={checked}
    >
      {label}
    </Button>
  );
};

export default FilterChip;
