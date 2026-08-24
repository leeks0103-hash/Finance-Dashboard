import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './ScrollTop.module.css';

// 스크롤이 이 정도 내려가야 "맨 위로" 버튼이 뜸 — 화면 상단 근처에서는 눌러도 의미 없어서 숨김
const SCROLL_TOP_THRESHOLD_PX = 400;

const ScrollTop = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SCROLL_TOP_THRESHOLD_PX);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollUp = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (!visible) return null;

  return (
    <Button unstyled className={styles.btn} onClick={scrollUp} aria-label="맨 위로">
      ↑
    </Button>
  );
};

export default ScrollTop;
