import { useState, type FormEvent } from 'react';
import { Button, Modal, ModalBadge, Toggle, confirmDialog } from '@/components/ui';
import type { useExtractJob } from '@/hooks/useExtractJob';
import { useVisibilitySettings } from '@/hooks/useVisibility';
import type { Visibility, VisibilitySettings } from '@/types/settings.types';
import type { ExtractTarget, ExtractMode } from '@/types/extract.types';
import ExtractCoverage from './ExtractCoverage';
import ExtractFilePicker from './ExtractFilePicker';
import FinMismatch from './FinMismatch';
import PerfUpdatePanel from './PerfUpdatePanel';
import styles from './AdminModal.module.css';

const EXTRACT_TARGET_LABEL: Record<ExtractTarget, string> = { finance: '재무', kpi: 'KPI' };

/** 방식 선택 버튼에 나오는 것만 — 'failed'(실패 파일만)는 추출 현황 카드의 버튼으로 따로 실행 */
/** 'force'(전체)는 버튼째 주석 처리(2026-10-20) — 다시 쓰려면 아래 Exclude에서 빼고 EXTRACT_MODE_INFO 주석 해제 */
type PickMode = Exclude<ExtractMode, 'failed' | 'force'>;
/** 지금 안 쓰는 방식 — 버튼은 보이되 못 누름. 다시 쓰려면 여기서 빼기 (2026-10-19엔 'force'가 여기 있었음) */
const DISABLED_MODES: ReadonlySet<PickMode> = new Set<PickMode>();
const EXTRACT_MODE_INFO: Record<PickMode, { label: string; desc: string }> = {
  incremental: {
    label: '증분',
    desc: '이전에 처리한 적 없는 새 파일 · 내용이 바뀐 파일만 골라서 반영합니다. 기존 데이터는 그대로 유지. 평소엔 이 방식을 씁니다.',
  },
  selected: {
    label: '선택',
    desc: '아래에서 고른 파일만 다시 읽습니다. 고른 파일 이름으로 남아 있던 기존 행은 지우고 새로 넣어(덮어쓰기) PPT에서 지운 행·바뀐 코드·지운 비고까지 그대로 반영합니다. 파일을 열지 못하면 기존 행은 그대로 둡니다. 다른 파일은 건드리지 않습니다. 빨간 행(!)은 데이터 이상(상단 "!" 배지)에 걸린 파일로 목록 맨 위에 모아 둡니다 — PPT를 고친 뒤 골라서 다시 추출하세요.',
  },
  // force: {
  //   label: '전체',
  //   desc: '기존 데이터는 지우지 않되, 모든 PPT 파일을 처음부터 다시 읽어 반영합니다. 추출 로직 자체를 고친 뒤 이미 처리된 파일에도 새 로직을 다시 적용하고 싶을 때 씁니다. 파일 수가 많으면 시간이 오래 걸립니다.',
  // },
  reset: {
    label: '초기화',
    desc: '기존 추출 데이터를 전부 지우고 모든 PPT 파일을 처음부터 다시 추출합니다.',
  },
};

type VisibilityOption = { value: Visibility; label: string; title: string };

/** 공개 범위 설정 — 서버(data/visibility.json)에 저장돼 모든 사람 화면에 같이 적용(2026-10-06) */
const VISIBILITY_ITEMS: { key: keyof VisibilitySettings; label: string; options: VisibilityOption[] }[] = [
  {
    // 파트별 계획 vs 실적 드릴다운의 달성률(행별·합계·CSV). 처음엔 저조한 팀이 드러나지 않게 '전체'를 뺐다가
    // 관리자가 고를 수 있게 추가(2026-10-14 요청). 기본값은 숨김
    key: 'achieveRate', label: '달성률',
    options: [
      { value: 'all',   label: '전체',   title: '모든 사람에게 달성률 표시' },
      { value: 'admin', label: '관리자', title: '관리자 인증한 브라우저에만 표시' },
      { value: 'none',  label: '숨김',   title: '아무에게도 표시 안 함' },
    ],
  },
  {
    key: 'fileOpen', label: '파일 바로가기(↗)',
    options: [
      { value: 'all',   label: '전체',   title: '모든 사람에게 ↗ 버튼 표시' },
      { value: 'admin', label: '관리자', title: '관리자 인증한 브라우저에만 표시' },
      { value: 'none',  label: '숨김',   title: '아무에게도 표시 안 함' },
    ],
  },
  {
    // 파일 바로가기와 따로(2026-10-20 요청 — ↗를 숨기면 폴더 버튼까지 같이 숨던 것)
    key: 'folderOpen', label: '폴더 바로가기',
    options: [
      { value: 'all',   label: '전체',   title: '모든 사람에게 폴더 열기 버튼 표시' },
      { value: 'admin', label: '관리자', title: '관리자 인증한 브라우저에만 표시' },
      { value: 'none',  label: '숨김',   title: '아무에게도 표시 안 함' },
    ],
  },
];

interface Props {
  /** Navbar의 useExtractJob 그대로 — 모달이 따로 만들면 인증 상태가 두 벌로 갈라져
   *  모달에서 인증해도 Navbar(추출 중 배지 등)는 모름 */
  extractJob: ReturnType<typeof useExtractJob>;
  onClose: () => void;
}

/**
 * ⚙ > 관리자용 기능 — 달성률 / 파일 바로가기 공개 범위 / PPT 데이터 추출 / 추출 현황.
 * 예전엔 280px 드롭다운 안에 다 들어 있어 비좁았고, 확인창 버튼을 누르면 "바깥 클릭"으로 드롭다운이
 * 닫히는 문제도 있어 모달로 분리(2026-09-30 요청). 권한(EXTRACT_ADMIN_KEY) 없으면 인증 버튼만 보임.
 */
const AdminModal = ({ extractJob, onClose }: Props) => {
  const visibility = useVisibilitySettings();

  // 추출이 이미 돌고 있으면 그 작업의 대상·방식으로 시작 — 모달을 다시 열어도 실제 작업과 어긋나지 않게
  const running = extractJob.isRunning ? extractJob.status : undefined;
  const [extractTargets, setExtractTargets] = useState<ExtractTarget[]>(
    () => running?.targets ?? ['finance', 'kpi'],
  );
  const [extractMode, setExtractMode] = useState<PickMode>(
    () => (running?.mode && running.mode in EXTRACT_MODE_INFO && !DISABLED_MODES.has(running.mode as PickMode) ? running.mode as PickMode : 'incremental'),
  );
  const extractLocked = extractJob.isRunning || extractJob.isStarting;
  // mode=selected — 다시 추출할 파일명(원본 폴더 기준)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [extractAuthError, setExtractAuthError] = useState('');

  const toggleExtractTarget = (t: ExtractTarget) => {
    setExtractTargets(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };
  // 사번·비밀번호 로그인(2026-10-06 — 예전엔 "이름/키" 한 칸 프롬프트). 틀리면 인라인 에러텍스트
  const [empNo, setEmpNo] = useState('');
  const [password, setPassword] = useState('');
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!empNo.trim() || !password) { setExtractAuthError('사번과 비밀번호를 입력하세요'); return; }
    const ok = await extractJob.authenticate({ empNo: empNo.trim(), password });
    setExtractAuthError(ok ? '' : '사번 또는 비밀번호가 올바르지 않습니다');
    if (ok) setPassword('');
  };
  const handleExtractRun = async () => {
    if (extractTargets.length === 0 || extractLocked) return;
    // 어떤 방식이든 실제로 PPT를 다시 읽어 엑셀을 덮어쓰는 작업이라, 무슨 대상을 어떤 방식으로
    // 돌리는지 한 번 보여주고 확인받는다(2026-09-23 — "당연히 물어볼 줄 알았지" 피드백,
    // 이전엔 reset일 때만 확인해서 증분/전체재처리는 바로 실행돼버렸음)
    const targetLabel = extractTargets.map(t => EXTRACT_TARGET_LABEL[t]).join(' + ');
    const modeInfo = EXTRACT_MODE_INFO[extractMode];
    if (extractMode === 'selected') {
      if (selectedFiles.length === 0) return;
      const shown = selectedFiles.slice(0, 8).map(f => `· ${f}`).join('\n');
      const more = selectedFiles.length > 8 ? `\n· 외 ${selectedFiles.length - 8}개` : '';
      const selMsg = `${targetLabel} — 고른 파일 ${selectedFiles.length}개를 다시 추출합니다.\n\n${shown}${more}\n\n`
        + '이 파일 이름으로 남은 기존 행은 지우고 새로 넣습니다. 다른 파일과 같은 (코드/연도/단계) 행이 있으면 이번 값으로 덮어씁니다.';
      if (!await confirmDialog(selMsg, { title: '선택한 파일 다시 추출', confirmText: '다시 추출' })) return;
      extractJob.run({ targets: extractTargets, mode: 'selected', files: selectedFiles });
      return;
    }
    const msg =`${targetLabel} 데이터를 "${modeInfo.label}" 방식으로 추출합니다.\n\n${modeInfo.desc}`;
    if (!await confirmDialog(msg, { danger: extractMode === 'reset' })) return;
    extractJob.run({ targets: extractTargets, mode: extractMode });
  };
  // 중지도 확인받음 — 예전엔 "의도적 클릭이라 생략"했지만(2026-09-23) 실행 버튼 바로 옆이라 잘못 누르기 쉽고,
  // 중지하면 마지막 저장 지점까지만 반영돼 다시 돌려야 해서(2026-09-30 요청)
  const handleExtractCancel = async () => {
    const ok = await confirmDialog(
      '진행 중인 PPT 데이터 추출을 정말 중지할까요?\n\n마지막으로 저장된 지점까지만 반영되고, 나머지는 다시 추출해야 합니다.',
      { title: '추출 중지', danger: true, confirmText: '중지', cancelText: '계속 진행' },
    );
    if (ok) extractJob.cancel();
  };
  // 추출 현황 카드의 "실패 N개 다시 추출" — 실패한 파일만 다시 읽음(DRM 파일도 시도 — 원본 대신 로컬 사본을 엶)
  const handleRetryFailed = async (target: ExtractTarget) => {
    if (extractLocked) return;
    const ok = await confirmDialog(
      `${EXTRACT_TARGET_LABEL[target]} 추출에서 실패한 파일만 다시 추출합니다.

`
      + '다른 파일과 기존 데이터는 그대로 둡니다. DRM(문서보안) 암호화 파일도 시도하며, 원본은 건드리지 않고 복사본으로 엽니다.',
      { title: '실패 파일 다시 추출', confirmText: '다시 추출', cancelText: '취소' },
    );
    if (ok) extractJob.run({ targets: [target], mode: 'failed' });
  };

  const sub = extractJob.isAuthed
    ? <><ModalBadge>인증됨</ModalBadge>{extractJob.authedName || '관리자'}</>
    : '관리자로 등록된 사번만 로그인할 수 있습니다';

  return (
    <Modal title="관리자 기능" sub={sub} width={extractJob.isAuthed ? 'min(860px, 94vw)' : 560} onClose={onClose}>
      {!extractJob.isAuthed ? (
        <form className={styles.auth} onSubmit={handleLogin}>
          <input className={styles.authInput} placeholder="사번" autoComplete="username" autoFocus
            value={empNo} onChange={e => setEmpNo(e.target.value)} disabled={extractJob.isAuthing} />
          <input className={styles.authInput} placeholder="비밀번호" type="password" autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)} disabled={extractJob.isAuthing} />
          {/* 로그인 중엔 입력칸·버튼 잠금, 사번·비밀번호 둘 다 채워야 버튼 활성(2026-10-06 요청) */}
          <Button type="submit" variant="primary" className={styles.authBtn} loading={extractJob.isAuthing}
            disabled={!empNo.trim() || !password}>
            로그인
          </Button>
          {extractAuthError && <span className={styles.error}>{extractAuthError}</span>}
          <span className={styles.hint}>한 번 로그인하면 이 브라우저에선 로그아웃 전까지 유지됩니다</span>
        </form>
      ) : (
        <div className={styles.groups}>
          {/* 공개 범위 두 개는 한 줄에 — 둘 다 짧은 세그먼트라. 바꾸면 모든 사람 화면에 적용 */}
          <div className={styles.twoCol}>
            {VISIBILITY_ITEMS.map(item => (
              <section key={item.key} className={styles.group}>
                <span className={styles.label}>{item.label}</span>
                <div className={styles.segment}>
                  {item.options.map(o => (
                    <Button key={o.value} variant="ghost" size="sm"
                      className={`${styles.segBtn} ${visibility.settings[item.key] === o.value ? styles.segActive : ''}`}
                      onClick={() => visibility.update({ [item.key]: o.value })}
                      disabled={visibility.isSaving}
                      title={o.title}
                    >{o.label}</Button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          {/* 기능 켜기·끄기 — 주석 풀지 않고 여기서(2026-10-20 요청). 켬 = 모두에게 보임 */}
          <section className={`${styles.group} ${styles.toggleGroup}`}>
            <div className={styles.toggleText}>
              <span className={styles.label}>AI 인사이트</span>
              <span className={styles.toggleDesc}>재무·KPI 탭 위쪽 'AI 인사이트' 버튼(H-chat 요약)을 모든 사람에게 보이기</span>
            </div>
            <Toggle
              checked={visibility.settings.aiInsight !== 'none'}
              onChange={() => visibility.update({ aiInsight: visibility.settings.aiInsight === 'none' ? 'all' : 'none' })}
              disabled={visibility.isSaving}
              label={visibility.settings.aiInsight === 'none' ? '끔' : '켬'}
            />
          </section>
          <span className={styles.hint}>
            {visibility.isError
              ? <span className={styles.error}>공개 범위를 저장하지 못했습니다 — 다시 눌러 주세요</span>
              : '공개 범위는 이 화면뿐 아니라 접속한 모든 사람에게 적용됩니다(다른 화면엔 1분 안에 반영)'}
          </span>

          {/* 실적현황 파일 자동 반영 — data/에 넣거나 여기로 끌어다 놓으면 열 맞추기·검증 후 반영(2026-10-14, 10-15 켬).
              끄려면 이 줄 + 위 import 주석, 서버 performance.PERF_AUTO_UPDATE·paths.PERF_PICK_NEWEST False */}
          <PerfUpdatePanel />

          <section className={styles.group}>
            {/* 제목 오른쪽 끝에 마지막 추출 시각(2026-10-06 요청) */}
            <div className={styles.labelRow}>
              <span className={styles.label}>PPT 데이터 추출(파싱)</span>
              <span className={styles.lastRun} title="마지막으로 추출이 끝난 시각">
                마지막 추출 {extractJob.status?.last_extracted_at ?? extractJob.status?.finished_at?.slice(0, 16) ?? '-'}
              </span>
            </div>

            {/* 추출 진행 중엔 대상/방식을 바꿀 수 없게 잠금(2026-09-23 요청) */}
            <div className={styles.field}>
              <span className={styles.fieldLabel}>대상</span>
              <div className={styles.segment}>
                {(['finance', 'kpi'] as ExtractTarget[]).map(t => (
                  <Button key={t} variant="ghost" size="sm"
                    className={`${styles.segBtn} ${extractTargets.includes(t) ? styles.segActive : ''}`}
                    onClick={() => toggleExtractTarget(t)}
                    disabled={extractLocked}
                  >{EXTRACT_TARGET_LABEL[t]}</Button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>방식</span>
              <div className={styles.segment}>
                {(Object.keys(EXTRACT_MODE_INFO) as PickMode[]).map(m => (
                  <Button key={m} variant="ghost" size="sm"
                    className={`${styles.segBtn} ${extractMode === m ? styles.segActive : ''}`}
                    onClick={() => setExtractMode(m)}
                    disabled={extractLocked || DISABLED_MODES.has(m)}
                    title={DISABLED_MODES.has(m) ? '지금은 쓰지 않는 방식 — 증분·초기화를 쓰세요' : undefined}
                  >{EXTRACT_MODE_INFO[m].label}</Button>
                ))}
              </div>
            </div>

            {/* 선택된 방식 설명 — 설명 3개를 한 칸에 겹쳐 두고 선택된 것만 보이게.
                칸 높이가 항상 가장 긴 설명 기준이라 방식을 바꿔도 모달 높이가 출렁이지 않음 */}
            <div className={styles.hintStack}>
              {(Object.keys(EXTRACT_MODE_INFO) as PickMode[]).map(m => (
                <span key={m} className={`${styles.hint} ${m === extractMode ? '' : styles.hintHidden}`}>
                  {EXTRACT_MODE_INFO[m].desc}
                </span>
              ))}
            </div>

            {extractMode === 'selected' && (
              <ExtractFilePicker selected={selectedFiles} onChange={setSelectedFiles}
                targets={extractTargets} disabled={extractLocked} />
            )}

            {/* KPI 추출은 스킵 로직 자체가 없어 매번 전량 재파싱 — 방식 토글이 안 먹힘을 알림(자리 고정) */}
            <span className={`${styles.hint} ${extractTargets.includes('kpi') && extractMode !== 'selected' ? '' : styles.hintHidden}`}>
              KPI는 매번 전체 재처리라 방식 선택과 무관합니다{extractTargets.includes('finance') ? ' (재무에만 적용)' : ''}
            </span>

            <div className={styles.actions}>
              <Button
                variant={extractMode === 'reset' ? 'danger' : 'primary'}
                size="sm"
                loading={extractLocked}
                disabled={extractTargets.length === 0 || extractLocked || (extractMode === 'selected' && selectedFiles.length === 0)}
                onClick={handleExtractRun}
              >
                {extractJob.isRunning ? '추출 중…' : extractMode === 'selected' ? `선택한 ${selectedFiles.length}개 다시 추출` : '실행'}
              </Button>
              {/* 중지 — wb.save()가 파일 처리 루프 안에서 거의 안 불려서 대부분 안전하지만
                  100% 보장은 아님(app.py api_extract_cancel 주석 참고). 확인창 거친 뒤 중지 */}
              {extractJob.isRunning && (
                <Button variant="danger" size="sm" loading={extractJob.isCancelling} onClick={handleExtractCancel}>
                  중지
                </Button>
              )}
            </div>

            {extractJob.isRunning && extractJob.status?.started_at && (
              <span className={styles.result}>
                {extractJob.status.started_by ? `${extractJob.status.started_by} · ` : ''}
                {extractJob.status.started_at} 시작 — 이 창을 닫아도 계속 진행됩니다
              </span>
            )}
            {extractJob.startResult?.ok === false && (
              <span className={styles.error}>{extractJob.startResult.error}</span>
            )}
            {!extractJob.isRunning && extractJob.status?.finished_at && (
              <span className={extractJob.status.ok ? styles.result : styles.error}>
                {extractJob.status.ok
                  ? `완료 (${extractJob.status.finished_at})`
                  : extractJob.status.cancelled
                    ? '중지됨'
                    : `실패 — ${extractJob.status.message.slice(0, 300)}`}
              </span>
            )}
          </section>

          {/* 추출 현황 — 폴더 파일 수 vs 실제로 들어간 파일, 안 된 파일과 이유(2026-10-01) */}
          <ExtractCoverage finishedAt={extractJob.status?.finished_at}
            onRetryFailed={handleRetryFailed} retryDisabled={extractLocked} />

          {/* 완료 프로젝트 재무 불일치 — 목록·CSV(2026-10-06) */}
          <FinMismatch />

          <Button variant="ghost" size="sm" className={styles.logoutBtn} onClick={extractJob.logout}>
            로그아웃
          </Button>
        </div>
      )}
    </Modal>
  );
};

export default AdminModal;
