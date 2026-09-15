import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Toggle, Button, CopyText } from '@/components/ui';
import TabNav from '@/components/ui/TabNav/TabNav';
import type { TabId } from '@/components/ui/TabNav/TabNav';
import KpiActionBar from '@/components/features/KpiActionBar';
import NgvLogo from './NgvLogo';
import { useTheme } from '@/hooks';
import { useDataHealth } from '@/hooks/useDataHealth';
// import { useOpenFile } from '@/hooks/useOpenFile';   // 파일 바로가기 버튼 주석 처리로 미사용(2026-09-15)
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

  // KPI ↔ 재무 데이터 프로젝트코드 불일치 감지 — 평소엔 안 보이고, 있을 때만 ⚙ 왼쪽에 경고 뱃지
  const { data: health } = useDataHealth();
  const healthRows = health?.rows ?? [];
  const [healthOpen, setHealthOpen] = useState(false);
  const healthRef = useRef<HTMLDivElement>(null);
  // const { openFile } = useOpenFile();   // 파일 바로가기 버튼 주석 처리로 미사용(2026-09-15)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (healthRef.current && !healthRef.current.contains(e.target as Node)) setHealthOpen(false);
    };
    if (healthOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [healthOpen]);

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

        {/* 우측 — (KPI 탭) 다운로드 + 설정 */}
        <div className={styles.right}>
          {activeTab === 'kpi' && <KpiActionBar />}

          {healthRows.length > 0 && (
            <div className={styles.health} ref={healthRef}>
              <Button unstyled
                className={styles.healthBtn}
                onClick={() => setHealthOpen(v => !v)}
                aria-label={`KPI/재무 데이터 불일치 ${healthRows.length}건`}
                aria-expanded={healthOpen}
                title={`KPI/재무 데이터 프로젝트코드 불일치 ${healthRows.length}건`}
              >
                !
              </Button>

              {healthOpen && (
                <div className={styles.healthDropdown}>
                  <div className={styles.healthHeader}>
                    KPI ↔ 재무 프로젝트코드 불일치 · {healthRows.length}건
                  </div>
                  <ul className={styles.healthList}>
                    {healthRows.map(row => (
                      <li key={row.file} className={styles.healthItem}>
                        <div className={styles.healthFileRow}>
                          <CopyText text={row.file} className={styles.healthFile} />
                          {/* 파일 바로가기 버튼 — 일단 전부 주석 처리 (2026-09-15)
                          <Button unstyled
                            className={styles.healthOpenBtn}
                            onClick={() => openFile(row.file)}
                            title="원본 PPT 열기"
                            aria-label="원본 PPT 열기"
                          >
                            ↗
                          </Button>
                          */}
                        </div>
                        <div className={styles.healthCodes}>
                          <span>재무: {row.finance_codes.join(', ') || '—'}</span>
                          <span>KPI: {row.kpi_codes.join(', ') || '—'}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

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
