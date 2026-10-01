import { useState } from 'react';
import { Toggle, Button, Modal, ModalBadge, confirmDialog, promptDialog } from '@/components/ui';
import type { useExtractJob } from '@/hooks/useExtractJob';
import { useUiStore } from '@/store';
import type { FileOpenVisibility } from '@/store/ui.store';
import type { ExtractTarget, ExtractMode } from '@/types/extract.types';
import ExtractCoverage from './ExtractCoverage';
import styles from './AdminModal.module.css';

const EXTRACT_TARGET_LABEL: Record<ExtractTarget, string> = { finance: '재무', kpi: 'KPI' };

/** 방식 선택 버튼에 나오는 것만 — 'failed'(실패 파일만)는 추출 현황 카드의 버튼으로 따로 실행 */
type PickMode = Exclude<ExtractMode, 'failed'>;
const EXTRACT_MODE_INFO: Record<PickMode, { label: string; desc: string }> = {
  incremental: {
    label: '증분',
    desc: '이전에 처리한 적 없는 새 파일 · 내용이 바뀐 파일만 골라서 반영합니다. 기존 데이터는 그대로 유지. 평소엔 이 방식을 씁니다.',
  },
  force: {
    label: '전체',
    desc: '기존 데이터는 지우지 않되, 모든 PPT 파일을 처음부터 다시 읽어 반영합니다. 추출 로직 자체를 고친 뒤 이미 처리된 파일에도 새 로직을 다시 적용하고 싶을 때 씁니다. 파일 수가 많으면 시간이 오래 걸립니다.',
  },
  reset: {
    label: '초기화',
    desc: '기존 추출 데이터를 전부 지우고 모든 PPT 파일을 처음부터 다시 추출합니다.',
  },
};

const FILE_OPEN_OPTIONS: { value: FileOpenVisibility; label: string; title: string }[] = [
  { value: 'all',   label: '전체',     title: '모든 사람에게 ↗ 버튼 표시' },
  { value: 'admin', label: '관리자',   title: '관리자 인증한 브라우저에만 표시' },
  { value: 'none',  label: '숨김',     title: '아무에게도 표시 안 함' },
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
  const {
    showAchieveRate, toggleAchieveRate, fileOpenVisibility, setFileOpenVisibility,
  } = useUiStore();

  // 추출이 이미 돌고 있으면 그 작업의 대상·방식으로 시작 — 모달을 다시 열어도 실제 작업과 어긋나지 않게
  const running = extractJob.isRunning ? extractJob.status : undefined;
  const [extractTargets, setExtractTargets] = useState<ExtractTarget[]>(
    () => running?.targets ?? ['finance', 'kpi'],
  );
  const [extractMode, setExtractMode] = useState<PickMode>(
    () => (running?.mode && running.mode !== 'failed' ? running.mode : 'incremental'),
  );
  const extractLocked = extractJob.isRunning || extractJob.isStarting;
  const [extractAuthError, setExtractAuthError] = useState('');

  const toggleExtractTarget = (t: ExtractTarget) => {
    setExtractTargets(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };
  // prompt 2번(키/이름) + 틀렸을 때 alert 1번 → prompt 1번 + 인라인 에러텍스트로 축소
  // (2026-09-23, "알럿창 컨펌창 토스트창 감당 안 되네" 피드백)
  const handleExtractAuth = async () => {
    const input = await promptDialog('이름/키를 입력하세요', { placeholder: '홍길동/발급받은 키' });
    if (!input) return;
    const slash = input.indexOf('/');
    const name = (slash === -1 ? '' : input.slice(0, slash)).trim();
    const key = (slash === -1 ? input : input.slice(slash + 1)).trim();
    const ok = await extractJob.authenticate({ key, name });
    setExtractAuthError(ok ? '' : '이름 또는 키가 올바르지 않습니다 (예: 홍길동/발급받은 키)');
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
  // 중지도 확인받음 — 예전엔 "의도적 클릭이라 생략"했지만(2026-09-23) 실행 버튼 바로 옆이라 잘못 누르기 쉽고,
  // 중지하면 마지막 저장 지점까지만 반영돼 다시 돌려야 해서(2026-09-30 요청)
  const handleExtractCancel = async () => {
    const ok = await confirmDialog(
      '진행 중인 PPT 데이터 추출을 정말 중지할까요?\n\n마지막으로 저장된 지점까지만 반영되고, 나머지는 다시 추출해야 합니다.',
      { title: '추출 중지', danger: true, confirmText: '중지', cancelText: '계속 진행' },
    );
    if (ok) extractJob.cancel();
  };
  // 추출 현황 카드의 "실패 N개 다시 추출" — 실패한 파일만 다시 읽음(DRM 파일은 서버가 뺌, 2026-10-01 요청)
  const handleRetryFailed = async (target: ExtractTarget) => {
    if (extractLocked) return;
    const ok = await confirmDialog(
      `${EXTRACT_TARGET_LABEL[target]} 추출에서 실패한 파일만 다시 추출합니다.

`
      + '다른 파일과 기존 데이터는 그대로 둡니다. DRM(문서보안) 암호화 파일은 열면 원본이 재암호화될 수 있어 제외합니다.',
      { title: '실패 파일 다시 추출', confirmText: '다시 추출', cancelText: '취소' },
    );
    if (ok) extractJob.run({ targets: [target], mode: 'failed' });
  };

  const sub = extractJob.isAuthed
    ? <><ModalBadge>인증됨</ModalBadge>{extractJob.authedName || '관리자'}</>
    : '관리자 키가 있는 사람만 사용할 수 있습니다';

  return (
    <Modal title="관리자용 기능" sub={sub} width={560} onClose={onClose}>
      {!extractJob.isAuthed ? (
        <div className={styles.auth}>
          <Button variant="primary" size="sm" onClick={handleExtractAuth} disabled={extractJob.isAuthing}>
            관리자 인증
          </Button>
          {extractAuthError && <span className={styles.error}>{extractAuthError}</span>}
        </div>
      ) : (
        <div className={styles.groups}>
          {/* 표시 설정 두 개는 한 줄에 — 둘 다 짧은 스위치/세그먼트라 */}
          <div className={styles.twoCol}>
            {/* 달성률 표시 — 파트별 계획 vs 실적 드릴다운의 달성률(행별·합계·CSV). 기본 꺼짐.
                저조한 팀이 한눈에 드러나지 않게 관리자만 켤 수 있게 둠(2026-09-29) */}
            <section className={styles.group}>
              <span className={styles.label}>달성률</span>
              <div className={styles.row}>
                <span className={styles.rowText}>{showAchieveRate ? '표시 중' : '숨김'}</span>
                <Toggle checked={showAchieveRate} onChange={toggleAchieveRate} />
              </div>
            </section>

            {/* 파일 바로가기(↗) 공개 범위 — 기본 관리자만(2026-09-30) */}
            <section className={styles.group}>
              <span className={styles.label}>파일 바로가기(↗)</span>
              <div className={styles.segment}>
                {FILE_OPEN_OPTIONS.map(o => (
                  <Button key={o.value} variant="ghost" size="sm"
                    className={`${styles.segBtn} ${fileOpenVisibility === o.value ? styles.segActive : ''}`}
                    onClick={() => setFileOpenVisibility(o.value)}
                    title={o.title}
                  >{o.label}</Button>
                ))}
              </div>
            </section>
          </div>

          <section className={styles.group}>
            <span className={styles.label}>PPT 데이터 추출(파싱)</span>

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
                    disabled={extractLocked}
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

            {/* KPI 추출은 스킵 로직 자체가 없어 매번 전량 재파싱 — 방식 토글이 안 먹힘을 알림(자리 고정) */}
            <span className={`${styles.hint} ${extractTargets.includes('kpi') ? '' : styles.hintHidden}`}>
              KPI는 매번 전체 재처리라 방식 선택과 무관합니다{extractTargets.includes('finance') ? ' (재무에만 적용)' : ''}
            </span>

            <div className={styles.actions}>
              <Button
                variant={extractMode === 'reset' ? 'danger' : 'primary'}
                size="sm"
                loading={extractLocked}
                disabled={extractTargets.length === 0 || extractLocked}
                onClick={handleExtractRun}
              >
                {extractJob.isRunning ? '추출 중…' : '실행'}
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
        </div>
      )}
    </Modal>
  );
};

export default AdminModal;
