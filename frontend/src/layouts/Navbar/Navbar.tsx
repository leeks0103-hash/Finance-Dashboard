import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Toggle, Button, CopyText } from '@/components/ui';
import { usePresence } from '@/components/ui/useAnimatedClose';
import TabNav from '@/components/ui/TabNav/TabNav';
import type { TabId } from '@/components/ui/TabNav/TabNav';
import KpiActionBar from '@/components/features/KpiActionBar';
import PerformanceActionBar from '@/components/features/PerformanceActionBar';
import FinanceDataModal from '@/components/features/FinanceDataModal';
import { useProductTour } from '@/components/features/ProductTour';
import NgvLogo from './NgvLogo';
import ngvCiUrl from '@/assets/hyundai-ngv-ci.png';
import AdminModal from './AdminModal';
import { useTheme } from '@/hooks';
import { useDataHealth } from '@/hooks/useDataHealth';
import { useChartLabelToggle } from '@/hooks/useChartLabelToggle';
import { useExtractJob } from '@/hooks/useExtractJob';
import { useOpenFile } from '@/hooks/useOpenFile';
import { useUiStore } from '@/store';
import { pathToTab } from '@/utils/routing';
import styles from './Navbar.module.css';

/** 테마 아이콘 — 이모지(🌙☀) 대신 SVG. 글자색(currentColor)을 따름.
 *  처음엔 가는 선(1.8px)이었는데 금색 해가 흰 바탕에서 거의 안 보여서(2026-09-30) 면을 채우고 광선을 굵게 */
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z" />
  </svg>
);
const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4.6" stroke="none" />
    <path d="M12 2.2v2.3M12 19.5v2.3M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.2 12h2.3M19.5 12h2.3M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
  </svg>
);

const Navbar = () => {
  const { theme, toggle: toggleTheme } = useTheme();
  const { showRawValues, toggleRawValues } = useUiStore();
  // 그래프 수치 — 켤 때/끌 때 페이드(끌 때는 투명해진 뒤 숨김)
  const chartLabels = useChartLabelToggle();
  const [open, setOpen] = useState(false);
  const [financeModalOpen, setFinanceModalOpen] = useState(false);
  // 사용법 투어 — 첫 방문 1회 자동 실행(localStorage 기준), 이후엔 아래 설정 메뉴에서
  const tour = useProductTour();
  // 관리자용 기능(달성률·파일 바로가기·PPT 추출) — 모달로 분리(2026-09-30). 훅은 여기 하나만 두고
  // 모달에 넘김 — 추출 중 배지도 같은 인증·진행 상태를 봐야 해서
  const extractJob = useExtractJob();
  const [adminOpen, setAdminOpen] = useState(false);
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
  // 코드충돌 시트를 COM으로도 못 읽은 쪽 — 충돌이 "없는" 게 아니라 "모르는" 상태라 따로 알림
  // (2026-09-28, app.py _read_code_conflicts)
  const readFailures = health?.read_failures ?? [];
  const healthTotal = healthRows.length + healthConflicts.length + finishedAnomalies.length + readFailures.length;
  const [healthOpen, setHealthOpen] = useState(false);
  const healthRef = useRef<HTMLDivElement>(null);
  // 닫힐 때도 퇴장 애니메이션 동안 남겨둠(index.css .closingDrop) — 예전엔 뚝 사라졌음
  // 설정 패널은 자체 퇴장(Navbar.module.css .dropdown.closing, 0.32s) — 그 길이만큼 남겨둠
  const settingsDrop = usePresence(open, 320);
  const healthDrop   = usePresence(healthOpen);
  // "추출 중…" 배지 — 추출이 끝나도 퇴장 애니메이션 동안 남겨둠
  const extractBadge = usePresence(extractJob.isAuthed && extractJob.isRunning);
  // PPT 파일명 옆 ↗ 바로가기(CopyText onOpen) — 2026-09-15 주석 처리했다가 2026-09-29 복구
  const { openFile } = useOpenFile();

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
          {/* 로고·제목 클릭 → 첫 화면(경영실적/재무데이터). 이미 그 탭이면 맨 위로만 */}
          <Link
            to="/performance"
            className={styles.home}
            aria-label="경영현황 통합 대시보드 — 첫 화면으로"
            onClick={() => window.scrollTo({ top: 0 })}
          >
            {/* 라이트: 컬러 CI(흰 네비바) / 다크: 흰 선 SVG — CSS로 테마별 하나만 보임 */}
            <img src={ngvCiUrl} alt="Hyundai NGV" className={styles.logoImg} />
            <NgvLogo className={styles.logo} />
            <h1 className={styles.brand}>경영현황 통합 대시보드</h1>
          </Link>
        </div>

        {/* 중앙 — 탭 네비게이션 */}
        <nav className={styles.center} data-tour="tabs">
          <TabNav active={activeTab} onChange={setTab} />
        </nav>

        {/* 우측 — (KPI/실적현황 탭) 다운로드 + 설정 */}
        <div className={styles.right}>
          {/* 인사이트 버튼(각 ActionBar의 첫 자식) 왼쪽에 배치 — 항상 마운트해두고 없을 때만
              visibility:hidden으로 숨김(display:none/조건부 마운트 대신). 그래야 이상 건수가
              0→N으로 바뀌는 순간에도 이 자리(너비+gap)가 그대로라 옆 버튼들이 리플로우로
              밀리지 않음(예전엔 조건부 렌더로 나타날 때마다 ActionBar가 옆으로 밀렸음) */}
          {/* 나타나고 사라질 때 살짝 커지며 페이드(.healthShown) — 예전엔 인라인 visibility로 뚝 켜지고 꺼졌음 */}
          <div
            className={`${styles.health} ${healthTotal > 0 ? styles.healthShown : ''}`}
            ref={healthRef}
            data-tour="health"
            aria-hidden={healthTotal === 0}
          >
              <Button unstyled
                className={styles.healthBtn}
                onClick={() => setHealthOpen(v => !v)}
                tabIndex={healthTotal > 0 ? 0 : -1}
                aria-label={`KPI/재무 데이터 이상 ${healthTotal}건`}
                aria-expanded={healthOpen}
                title={`KPI/재무 데이터 이상 ${healthTotal}건 (코드 충돌 ${healthConflicts.length} / KPI↔재무 코드 불일치 ${healthRows.length} / 완료보고 이상 ${finishedAnomalies.length}${readFailures.length ? ` / 코드충돌 시트 읽기 실패 ${readFailures.length}` : ''})`}
              >
                !
              </Button>

              {healthDrop.mounted && healthTotal > 0 && (
                <div className={`${styles.healthDropdown} ${healthDrop.closing ? 'closingDrop' : ''}`}>
                  {/* 문제 유형별로 섹션을 분리 — 각 섹션 아이콘·좌측 악센트로 종류를 한눈에
                      구분(2026-09-22, "코드충돌인지 중복인지 완료보고 문제인지 영역 잘 나눠라") */}
                  {readFailures.length > 0 && (
                    <section className={`${styles.healthSection} ${styles.accentConflict}`}>
                      <div className={styles.healthHeader}>
                        <span className={styles.healthIcon}>⚠</span>
                        코드충돌 시트를 읽지 못함 · {readFailures.map(f => f.source).join('/')}
                        <span className={styles.healthHeaderSub}>이 경우 코드 충돌 건이 목록에서 빠져 있을 수 있음</span>
                      </div>
                      <ul className={styles.healthList}>
                        {readFailures.map(f => (
                          <li key={f.source} className={styles.healthItem}>
                            <div className={styles.healthFileRow}>
                              <CopyText text={f.file} className={styles.healthFile} />
                            </div>
                            <div className={styles.healthCodes}>
                              <span>{f.source} 추출 엑셀 — 암호화(AIP) 후 Excel 자동 열기도 실패. 서버 로그 확인 또는 재추출 필요</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

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
                                <span key={f}>· <CopyText text={f} onOpen={openFile} /></span>
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
                              <CopyText text={row.file} className={styles.healthFile} onOpen={openFile} />
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
                              <CopyText text={a.filename} className={styles.healthFile} onOpen={openFile} />
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
                                <span key={f}>· <CopyText text={f} onOpen={openFile} /></span>
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

          {/* ⚙ 드롭다운을 닫아도 진행 상황을 놓치지 않도록 — 설정창 밖에 항상 보이는 작은 배지.
              권한 없는 사람에겐 이 기능 자체가 안 보여야 해서 isAuthed일 때만(2026-09-23 요청,
              "페이지에 재추출중입니다 스피너가 있어야할듯 — 전체 스켈레톤까진 필요없고") */}
          {extractBadge.mounted && (
            <Button unstyled
              className={`${styles.extractRunningBadge} ${extractBadge.closing ? 'closingDrop' : ''}`}
              onClick={() => setAdminOpen(true)}
              title="PPT 데이터 추출이 진행 중입니다 — 클릭해서 자세히 보기"
            >
              <span className={styles.extractSpinner} aria-hidden />
              추출 중…
            </Button>
          )}

          <div className={styles.settings} ref={ref} data-tour="settings">
          <Button unstyled
            className={styles.settingsBtn}
            onClick={() => setOpen(v => !v)}
            aria-label="설정"
            aria-expanded={open}
          >
            ⚙
          </Button>

          {settingsDrop.mounted && (
            <div className={`${styles.dropdown} ${settingsDrop.closing ? styles.closing : ''}`}>
              <div className={styles.section}>
                <span className={styles.sectionLabel}>테마</span>
                {/* 다른 설정 줄과 같게 [모드 이름+아이콘 | 토글 오른쪽]. 아이콘은 지금 테마 것 하나만 — key로 바뀔 때마다 살짝 등장 */}
                <div className={styles.row}>
                  <span className={styles.rowText}>
                    {theme === 'dark' ? '야간 모드' : '주간 모드'}
                    <span key={theme} className={`${styles.themeIcon} ${theme === 'dark' ? styles.moon : styles.sun}`}>
                      {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
                    </span>
                  </span>
                  <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
                </div>
              </div>

              <div className={styles.divider} />

              <div className={styles.section}>
                <span className={styles.sectionLabel}>그래프 수치</span>
                <div className={styles.row}>
                  <span className={styles.rowText}>{chartLabels.checked ? '표시 중' : '숨김'}</span>
                  <Toggle checked={chartLabels.checked} onChange={chartLabels.toggle} />
                </div>
              </div>

              <div className={styles.divider} />

              {/* 표 금액·비율 실제값 — 켜면 프로젝트 상세·재무 이력·재무 검색 결과·재무 데이터 모달 표가
                  억/만 축약·반올림 대신 원본 값(툴팁 값)을 표시. 표마다 두지 않고 전역 설정으로 */}
              <div className={styles.section}>
                <span className={styles.sectionLabel}>표 실제값</span>
                <div className={styles.row}>
                  <span className={styles.rowText}>{showRawValues ? '원 단위' : '억/만 반올림'}</span>
                  <Toggle checked={showRawValues} onChange={toggleRawValues} />
                </div>
              </div>

              <div className={styles.divider} />

              {/* 재무 데이터 탭 자체가 네비게이션에서 빠져있어(TabNav 주석 참고) 재무 원본
                  표만 단독으로 볼 방법이 없다는 요청으로 추가 — 탭 전환 없이 바로 모달로 확인.
                  위 두 섹션(테마·그래프 수치)과 동일하게 sectionLabel을 붙이고, 커스텀
                  플랫 스타일 대신 다른 액션 버튼들(↺ 다시 분석, ↓ CSV 등)과 같은 실제
                  Button ghost variant를 써서 사이트 톤에 맞춤(2026-09-22 피드백) */}
              <div className={styles.section}>
                <span className={styles.sectionLabel}>바로가기</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.financeBtn}
                  onClick={() => { setFinanceModalOpen(true); setOpen(false); }}
                >
                  재무데이터 확인
                </Button>
              </div>

              <div className={styles.divider} />

              <div className={styles.section}>
                <span className={styles.sectionLabel}>도움말</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.financeBtn}
                  onClick={() => { setOpen(false); tour.start(); }}
                >
                  사용방법(튜토리얼)
                </Button>
              </div>

              <div className={styles.divider} />

              {/* 관리자용 기능 — 달성률 / 파일 바로가기 공개 범위 / PPT 데이터 추출(인증 포함)은 모달에서.
                  280px 드롭다운엔 비좁았고, 확인창 버튼을 누르면 바깥 클릭으로 드롭다운이 닫히던 문제도 있어
                  분리(2026-09-30). 권한 없는 사람은 모달 안에서 인증 버튼만 보임 */}
              <div className={styles.section}>
                <span className={styles.sectionLabel}>관리자용 기능</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.financeBtn}
                  icon={extractJob.isRunning ? <span className={styles.adminBusySpinner} aria-hidden /> : undefined}
                  aria-busy={extractJob.isRunning}
                  onClick={() => { setOpen(false); setAdminOpen(true); }}
                >
                  {extractJob.isRunning ? '관리자용 기능 (추출 중…)' : '관리자용 기능 열기'}
                </Button>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {financeModalOpen && <FinanceDataModal onClose={() => setFinanceModalOpen(false)} />}
      {adminOpen && <AdminModal extractJob={extractJob} onClose={() => setAdminOpen(false)} />}
    </header>
  );
};

export default Navbar;
