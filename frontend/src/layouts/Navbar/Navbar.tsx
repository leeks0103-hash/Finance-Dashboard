import { useState, useRef, useEffect } from 'react';
import { Toggle, Button } from '@/components/ui';
import { useTheme } from '@/hooks';
import { useUiStore } from '@/store';
import styles from './Navbar.module.css';

const Navbar = () => {
  const { theme, toggle: toggleTheme } = useTheme();
  const { showChartLabels, toggleChartLabels } = useUiStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <nav className={styles.nav}>
      <span className={styles.brand}>프로젝트 재무 대시보드</span>

      <div className={styles.right}>
        <span className={styles.team}>기술교육사업기획팀</span>

        <div className={styles.settings} ref={ref}>
          <Button variant="ghost" size="sm"
            className={styles.settingsBtn}
            onClick={() => setOpen(v => !v)}
            aria-label="설정"
            aria-expanded={open}
          >
            ⚙
          </Button>

          {open && (
            <div className={styles.dropdown}>
              <div className={styles.section}>
                <span className={styles.sectionLabel}>테마</span>
                <div className={styles.row}>
                  <span className={`${styles.rowIcon} ${styles.moon} ${theme === 'dark' ? styles.active : ''}`}>🌙</span>
                  <Toggle checked={theme === 'light'} onChange={toggleTheme} />
                  <span className={`${styles.rowIcon} ${styles.sun} ${theme === 'light' ? styles.active : ''}`}>☀</span>
                </div>
              </div>

              <div className={styles.divider} />

              <div className={styles.section}>
                <span className={styles.sectionLabel}>그래프 수치</span>
                <div className={styles.row}>
                  <span className={styles.rowText}>{showChartLabels ? '표시 중' : '숨김'}</span>
                  <Toggle checked={showChartLabels} onChange={toggleChartLabels} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
