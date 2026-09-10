import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Toggle, Button } from '@/components/ui';
import TabNav from '@/components/ui/TabNav/TabNav';
import type { TabId } from '@/components/ui/TabNav/TabNav';
import NgvLogo from './NgvLogo';
import { useTheme } from '@/hooks';
import { useUiStore } from '@/store';
import { pathToTab } from '@/utils/routing';
import styles from './Navbar.module.css';

const Navbar = () => {
  const { theme, toggle: toggleTheme } = useTheme();
  const { showChartLabels, toggleChartLabels } = useUiStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeTab = pathToTab(pathname);
  const setTab = (tab: TabId) => navigate(`/${tab}`);


  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* 좌측 — 로고 + 제목 */}
        <div className={styles.left}>
          <NgvLogo className={styles.logo} />
          <h1 className={styles.brand}>경영현황 통합 대시보드</h1>
        </div>

        {/* 중앙 — 탭 네비게이션 */}
        <nav className={styles.center}>
          <TabNav active={activeTab} onChange={setTab} />
        </nav>

        {/* 우측 — 설정 */}
        <div className={styles.right}>
          <div className={styles.settings} ref={ref}>
          <Button unstyled
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
      </div>
    </header>
  );
};

export default Navbar;
