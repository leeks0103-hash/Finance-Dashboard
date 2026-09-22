import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Toggle, Button, CopyText } from '@/components/ui';
import TabNav from '@/components/ui/TabNav/TabNav';
import type { TabId } from '@/components/ui/TabNav/TabNav';
import KpiActionBar from '@/components/features/KpiActionBar';
import PerformanceActionBar from '@/components/features/PerformanceActionBar';
import FinanceDataModal from '@/components/features/FinanceDataModal';
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
  const [financeModalOpen, setFinanceModalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeTab = pathToTab(pathname);
  const setTab = (tab: TabId) => navigate(`/${tab}`);

  // KPI ↔ 재무 데이터 프로젝트코드 불일치 감지 — 평소엔 안 보이고, 있을 때만 ⚙ 왼쪽에 경고 뱃지
  const { data: health } = useDataHealth();
  const healthRows = health?.rows ?? [];
  // 코드 충돌(서로 다른 PPT가 같은 키를 공유해 한쪽이 덮어써진 경우) — 덮어써진 파일은
  // healthRows(파일명 기준 비교)로는 안 잡히므로 별도로 노출.
  // verdict로 한 번 더 걸러서, "한 파일에 여러 프로젝트 + 배치 보고서 제목만 단계마다 바뀐"
  // 오탐(likely_same_project)은 배지 건수·경고 목록에서 빼고 참고용으로만 접어서 보여줌
  // (2026-09-21 — 매치업 사례 실측 후 반영, app.py _classify_conflict 참고)
  const allConflicts = health?.conflicts ?? [];
  const healthConflicts = allConflicts.filter(c => c.verdict !== 'likely_same_project');
  const likelyOkConflicts = allConflicts.filter(c => c.verdict === 'likely_same_project');
  // "완료" 단계인데 매출·직접원가 외 값이 채워진 파일 — PPT 양식 정책상 있으면 안 되는 값
  // (2026-09-22 요청, app.py _read_finished_report_anomalies)
  const finishedAnomalies = health?.finished_anomalies ?? [];
  const healthTotal = healthRows.length + healthConflicts.length + finishedAnomalies.length;
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

        {/* 우측 — (KPI/실적현황 탭) 다운로드 + 설정 */}
        <div className={styles.right}>
          {/* 인사이트 버튼(각 ActionBar의 첫 자식) 왼쪽에 배치 — 항상 마운트해두고 없을 때만
              visibility:hidden으로 숨김(display:none/조건부 마운트 대신). 그래야 이상 건수가
              0→N으로 바뀌는 순간에도 이 자리(너비+gap)가 그대로라 옆 버튼들이 리플로우로
              밀리지 않음(예전엔 조건부 렌더로 나타날 때마다 ActionBar가 옆으로 밀렸음) */}
          <div
            className={styles.health}
            ref={healthRef}
            style={{ visibility: healthTotal > 0 ? 'visible' : 'hidden' }}
            aria-hidden={healthTotal === 0}
          >
              <Button unstyled
                className={styles.healthBtn}
                onClick={() => setHealthOpen(v => !v)}
                tabIndex={healthTotal > 0 ? 0 : -1}
                aria-label={`KPI/재무 데이터 이상 ${healthTotal}건`}
                aria-expanded={healthOpen}
                title={`KPI/재무 데이터 이상 ${healthTotal}건 (코드 충돌 ${healthConflicts.length} / KPI↔재무 코드 불일치 ${healthRows.length} / 완료보고 이상 ${finishedAnomalies.length})`}
              >
                !
              </Button>

              {healthOpen && healthTotal > 0 && (
                <div className={styles.healthDropdown}>
                  {/* 문제 유형별로 섹션을 분리 — 각 섹션 아이콘·좌측 악센트로 종류를 한눈에
                      구분(2026-09-22, "코드충돌인지 중복인지 완료보고 문제인지 영역 잘 나눠라") */}
                  {healthConflicts.length > 0 && (
                    <section className={`${styles.healthSection} ${styles.accentConflict}`}>
                      <div className={styles.healthHeader}>
                        <span className={styles.healthIcon}>⚔</span>
                        코드 충돌 · {healthConflicts.length}건
                        <span className={styles.healthHeaderSub}>같은 코드를 서로 다른 PPT가 사용</span>
                      </div>
                      <ul className={styles.healthList}>
                        {healthConflicts.map(c => (
                          <li key={`${c.source}-${c.code}`} className={styles.healthItem}>
                            <div className={styles.healthFileRow}>
                              <CopyText text={c.code} className={styles.healthFile} />
                            </div>
                            <div className={styles.healthCodes}>
                              <span>{c.source} · {c.files.length}개 파일이 같은 코드 사용</span>
                              {c.files.map(f => (
                                <span key={f}>· <CopyText text={f} /></span>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {healthRows.length > 0 && (
                    <section className={`${styles.healthSection} ${styles.accentMismatch}`}>
                      <div className={styles.healthHeader}>
                        <span className={styles.healthIcon}>⇄</span>
                        KPI ↔ 재무 코드 불일치 · {healthRows.length}건
                        <span className={styles.healthHeaderSub}>같은 파일인데 양쪽에서 뽑힌 코드가 다름</span>
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
                    </section>
                  )}

                  {finishedAnomalies.length > 0 && (
                    <section className={`${styles.healthSection} ${styles.accentFinished}`}>
                      <div className={styles.healthHeader}>
                        <span className={styles.healthIcon}>▤</span>
                        완료보고 이상 · {finishedAnomalies.length}건
                        <span className={styles.healthHeaderSub}>매출·직접원가 외 값이 채워짐 — PPT 확인 필요</span>
                      </div>
                      <ul className={styles.healthList}>
                        {finishedAnomalies.map(a => (
                          <li key={a.filename + a.project_code} className={styles.healthItem}>
                            <div className={styles.healthFileRow}>
                              <CopyText text={a.filename} className={styles.healthFile} />
                            </div>
                            <div className={styles.healthCodes}>
                              <span>{a.part} · <CopyText text={a.project_code} /></span>
                              <span className={styles.healthFields}>
                                {a.fields.map(f => `${f.label} ${f.value.toLocaleString()}`).join(' · ')}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {likelyOkConflicts.length > 0 && (
                    <details className={styles.healthDetails}>
                      <summary className={styles.healthHeaderMuted}>
                        확인 · {likelyOkConflicts.length}건
                      </summary>
                      <ul className={styles.healthList}>
                        {likelyOkConflicts.map(c => (
                          <li key={`${c.source}-${c.code}`} className={styles.healthItem}>
                            <div className={styles.healthFileRow}>
                              <CopyText text={c.code} className={styles.healthFile} />
                            </div>
                            <div className={styles.healthCodes}>
                              <span>{c.source} · {c.files.length}개 파일이 같은 코드 사용</span>
                              {c.files.map(f => (
                                <span key={f}>· <CopyText text={f} /></span>
                              ))}
                            </div>
                            {c.reason && <div className={styles.healthReason}>{c.reason}</div>}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
          </div>

          {activeTab === 'kpi' && <KpiActionBar />}
          {activeTab === 'performance' && <PerformanceActionBar />}

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

              <div className={styles.divider} />

              {/* 재무 데이터 탭 자체가 네비게이션에서 빠져있어(TabNav 주석 참고) 재무 원본
                  표만 단독으로 볼 방법이 없다는 요청으로 추가 — 탭 전환 없이 바로 모달로 확인 */}
              <div className={styles.section}>
                <Button unstyled className={styles.financeBtn} onClick={() => { setFinanceModalOpen(true); setOpen(false); }}>
                  재무데이터 확인
                </Button>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {financeModalOpen && <FinanceDataModal onClose={() => setFinanceModalOpen(false)} />}
    </header>
  );
};

export default Navbar;
