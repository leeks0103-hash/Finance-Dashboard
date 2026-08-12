import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Toggle, Button } from '@/components/ui';
import TabNav from '@/components/ui/TabNav/TabNav';
import type { TabId } from '@/components/ui/TabNav/TabNav';
import { useTheme } from '@/hooks';
import { useUiStore } from '@/store';
import { pathToTab } from '@/utils/routing';
import styles from './Navbar.module.css';

const Navbar = () => {
  const { theme, toggle: toggleTheme } = useTheme();
  const { showChartLabels, toggleChartLabels, showLogScale, toggleLogScale, showYearChart, toggleYearChart } = useUiStore();
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
      <div className={styles.left}>
        <nav className={styles.nav}>
          <span className={styles.brand}>프로젝트 재무 대시보드</span>
        </nav>
        <TabNav active={activeTab} onChange={setTab} />
      </div>

      {/* 우측 — 팀명 + 설정 */}
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

              <div className={styles.divider} />

              <div className={styles.section}>
                <span className={styles.sectionLabel}>차트 옵션</span>
                <div className={styles.row}>
                  <span className={styles.rowText}>로그 스케일</span>
                  <Toggle checked={showLogScale} onChange={toggleLogScale} />
                </div>
                <div className={styles.row}>
                  <span className={styles.rowText}>연도 추이</span>
                  <Toggle checked={showYearChart} onChange={toggleYearChart} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
