import { useState, useEffect, useCallback } from 'react';
import styles from './ScrollTop.module.css';

const ScrollTop = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollUp = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (!visible) return null;

  return (
    <button className={styles.btn} onClick={scrollUp} aria-label="맨 위로">
      ↑
    </button>
  );
};

export default ScrollTop;
