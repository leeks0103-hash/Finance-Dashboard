import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Toggle, Button, CopyText, confirmDialog, promptDialog } from '@/components/ui';
import TabNav from '@/components/ui/TabNav/TabNav';
import type { TabId } from '@/components/ui/TabNav/TabNav';
import KpiActionBar from '@/components/features/KpiActionBar';
import PerformanceActionBar from '@/components/features/PerformanceActionBar';
import FinanceDataModal from '@/components/features/FinanceDataModal';
import NgvLogo from './NgvLogo';
import { useTheme } from '@/hooks';
import { useDataHealth } from '@/hooks/useDataHealth';
import { useExtractJob } from '@/hooks/useExtractJob';
// import { useOpenFile } from '@/hooks/useOpenFile';   // 파일 바로가기 버튼 주석 처리로 미사용(2026-09-15)
import { useUiStore } from '@/store';
import { pathToTab } from '@/utils/routing';
import type { ExtractTarget, ExtractMode } from '@/types/extract.types';
import styles from './Navbar.module.css';

const EXTRACT_TARGET_LABEL: Record<ExtractTarget, string> = { finance: '재무', kpi: 'KPI' };

const EXTRACT_MODE_INFO: Record<ExtractMode, { label: string; desc: string }> = {
  incremental: {
    label: '증분',
    desc: '이전에 처리한 적 없는 새 파일 · 내용이 바뀐 파일만 골라서 반영합니다. 기존 데이터는 그대로 유지. 평소엔 이 방식을 씁니다.',
  },
  force: {
    label: '전체 재처리',
    desc: '기존 데이터는 지우지 않되, 모든 PPT 파일을 처음부터 다시 읽어 반영합니다. 추출 로직 자체를 고친 뒤 이미 처리된 파일에도 새 로직을 다시 적용하고 싶을 때 씁니다. 파일 수가 많으면 시간이 오래 걸립니다.',
  },
  reset: {
    label: '초기화 후 재구축',
    desc: '기존 추출 데이터를 전부 지우고 모든 PPT 파일을 처음부터 다시 추출합니다.',
  },
};

const Navbar = () => {
  const { theme, toggle: toggleTheme } = useTheme();
  const { showChartLabels, toggleChartLabels } = useUiStore();
  const [open, setOpen] = useState(false);
  const [financeModalOpen, setFinanceModalOpen] = useState(false);
  // PPT 데이터 추출 — 권한(EXTRACT_ADMIN_KEY) 통과한 사람에게만 보임(useExtractJob 참고)
  const [extractTargets, setExtractTargets] = useState<ExtractTarget[]>(['finance', 'kpi']);
  const [extractMode, setExtractMode] = useState<ExtractMode>('incremental');
  const extractJob = useExtractJob();
  const extractLocked = extractJob.isRunning || extractJob.isStarting;
  const [extractAuthError, setExtractAuthError] = useState('');
  const toggleExtractTarget = (t: ExtractTarget) => {
    setExtractTargets(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };
  // prompt 2번(키/이름) + 틀렸을 때 alert 1번 → prompt 1번 + 인라인 에러텍스트로 축소
  // (2026-09-23, "알럿창 컨펌창 토스트창 감당 안 되네" 피드백)
  const handleExtractAuth = async () => {
    const input = await promptDialog('이름/키를 입력하세요', { placeholder: '홍길동/hmc-extract-2026' });
    if (!input) return;
    const slash = input.indexOf('/');
    const name = (slash === -1 ? '' : input.slice(0, slash)).trim();
    const key = (slash === -1 ? input : input.slice(slash + 1)).trim();
    const ok = await extractJob.authenticate({ key, name });
    setExtractAuthError(ok ? '' : '이름/키 형식이 올바르지 않습니다 (예: 홍길동/hmc-extract-2026)');
  };
  const handleExtractRun = async () => {
    if (extractTargets.length === 0 || extractLocked) return;
    // 어떤 방식이든 실제로 PPT를 다시 읽어 엑셀을 덮어쓰는 작업이라, 무슨 대상을 어떤 방식으로
    // 돌리는지 한 번 보여주고 확인받는다(2026-09-23 — "당연히 물어볼 줄 알았지" 피드백,
    // 이전엔 reset일 때만 확인해서 증분/전체재처리는 바로 실행돼버렸음)
    const targetLabel = extractTargets.map(t => EXTRACT_TARGET_LABEL[t]).join(' + ');
    const modeInfo = EXTRACT_MODE_INFO[extractMode];
    const msg = `${targetLabel} 데이터를 "${modeInfo.label}" 방식으로 추출합니다.\n\n${modeInfo.desc}`;
    if (!await confirmDialog(msg, { danger: extractMode === 'reset' })) return;
    extractJob.run({ targets: extractTargets, mode: extractMode });
  };
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

          {/* ⚙ 드롭다운을 닫아도 진행 상황을 놓치지 않도록 — 설정창 밖에 항상 보이는 작은 배지.
              권한 없는 사람에겐 이 기능 자체가 안 보여야 해서 isAuthed일 때만(2026-09-23 요청,
              "페이지에 재추출중입니다 스피너가 있어야할듯 — 전체 스켈레톤까진 필요없고") */}
          {extractJob.isAuthed && extractJob.isRunning && (
            <Button unstyled
              className={styles.extractRunningBadge}
              onClick={() => setOpen(true)}
              title="PPT 데이터 추출이 진행 중입니다 — 클릭해서 자세히 보기"
            >
              <span className={styles.extractSpinner} aria-hidden />
              추출 중…
            </Button>
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

              {/* PPT → 엑셀 추출 스크립트를 직접 실행 — 예전엔 별도 관리자 GUI(schedule_table,
                  포트 5500)에서만 가능했음. 아직 배포 전이라 권한(EXTRACT_ADMIN_KEY) 있는 사람
                  (본인 + 책임님)에게만 노출(2026-09-23 요청) — 인증 전엔 버튼 하나만 보임 */}
              <div className={styles.section}>
                <span className={styles.sectionLabel}>PPT 데이터 추출</span>

                {!extractJob.isAuthed ? (
                  <>
                    <Button
                      variant="ghost" size="sm"
                      className={styles.financeBtn}
                      onClick={handleExtractAuth}
                      disabled={extractJob.isAuthing}
                    >
                      관리자 인증
                    </Button>
                    {extractAuthError && <span className={styles.extractResultError}>{extractAuthError}</span>}
                  </>
                ) : (
                  <>
                    {/* 추출 진행 중엔 대상/방식을 바꿀 수 없게 잠금(2026-09-23 요청) */}
                    <div className={styles.viewToggle}>
                      <Button variant="ghost" size="sm"
                        className={`${styles.toggleBtn} ${extractTargets.includes('finance') ? styles.toggleActive : ''}`}
                        onClick={() => toggleExtractTarget('finance')}
                        disabled={extractLocked}
                      >재무</Button>
                      <Button variant="ghost" size="sm"
                        className={`${styles.toggleBtn} ${extractTargets.includes('kpi') ? styles.toggleActive : ''}`}
                        onClick={() => toggleExtractTarget('kpi')}
                        disabled={extractLocked}
                      >KPI</Button>
                    </div>

                    <div className={styles.viewToggle}>
                      <Button variant="ghost" size="sm"
                        className={`${styles.toggleBtn} ${extractMode === 'incremental' ? styles.toggleActive : ''}`}
                        onClick={() => setExtractMode('incremental')}
                        disabled={extractLocked}
                      >증분</Button>
                      <Button variant="ghost" size="sm"
                        className={`${styles.toggleBtn} ${extractMode === 'force' ? styles.toggleActive : ''}`}
                        onClick={() => setExtractMode('force')}
                        disabled={extractLocked}
                      >전체 재처리</Button>
                      <Button variant="ghost" size="sm"
                        className={`${styles.toggleBtn} ${extractMode === 'reset' ? styles.toggleActive : ''}`}
                        onClick={() => setExtractMode('reset')}
                        disabled={extractLocked}
                      >초기화 후 재구축</Button>
                    </div>

                    {/* 선택된 방식 설명 — 토글 3개 라벨만으론 뭐가 다른지 알기 어렵다는 피드백
                        (2026-09-23, "설명이 너무 간략해") */}
                    <span className={styles.extractHint}>{EXTRACT_MODE_INFO[extractMode].desc}</span>

                    {/* KPI 추출은 스킵 로직 자체가 없어 매번 전량 재파싱 — 방식 토글이 안 먹힘을 알림 */}
                    {extractTargets.includes('kpi') && (
                      <span className={styles.extractHint}>
                        KPI는 매번 전체 재처리라 방식 선택과 무관합니다{extractTargets.includes('finance') ? ' (재무에만 적용)' : ''}
                      </span>
                    )}

                    <div className={styles.extractActions}>
                      <Button
                        variant={extractMode === 'reset' ? 'danger' : 'primary'}
                        size="sm"
                        className={styles.financeBtn}
                        loading={extractLocked}
                        disabled={extractTargets.length === 0 || extractLocked}
                        onClick={handleExtractRun}
                      >
                        {extractJob.isRunning ? '추출 중…' : '실행'}
                      </Button>
                      {/* 중지 — wb.save()가 파일 처리 루프 안에서 거의 안 불려서 대부분 안전하지만
                          100% 보장은 아님(app.py api_extract_cancel 주석 참고). 버튼 자체가
                          명확한 의도적 클릭이라 확인창은 생략(2026-09-23, 다이얼로그 정리) */}
                      {extractJob.isRunning && (
                        <Button
                          variant="danger"
                          size="sm"
                          className={styles.financeBtn}
                          loading={extractJob.isCancelling}
                          onClick={() => extractJob.cancel()}
                        >
                          중지
                        </Button>
                      )}
                    </div>

                    {extractJob.startResult?.ok === false && (
                      <span className={styles.extractResultError}>{extractJob.startResult.error}</span>
                    )}
                    {!extractJob.isRunning && extractJob.status?.finished_at && (
                      <span className={extractJob.status.ok ? styles.extractResult : styles.extractResultError}>
                        {extractJob.status.ok
                          ? `완료 (${extractJob.status.finished_at})`
                          : extractJob.status.cancelled
                            ? '중지됨'
                            : `실패 — ${extractJob.status.message.slice(0, 120)}`}
                      </span>
                    )}
                  </>
                )}
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
