import { Button } from '@/components/ui';
import type { useExtractJob } from '@/hooks/useExtractJob';
import {
  useAdminExtractViewModel, EXTRACT_TARGET_LABEL, EXTRACT_MODE_INFO, PICK_MODES, DISABLED_MODES,
} from '@/hooks/viewmodels/useAdminExtractViewModel';
import type { ExtractTarget } from '@/types/extract.types';
import ExtractCoverage from './ExtractCoverage';
import ExtractFilePicker from './ExtractFilePicker';
import styles from './AdminSections.module.css';

interface Props {
  /** AdminPage의 useExtractJob 그대로 — 메뉴의 "추출 중…" 표시와 같은 인증·진행 상태를 봐야 함 */
  extractJob: ReturnType<typeof useExtractJob>;
  /** 업데이트 요청 "!"에서 넘어온 파일들 — 이 파일들을 고른 채 '선택' 방식으로 시작(2026-10-21) */
  initialSelected?: string[];
}

/**
 * 관리자 페이지 > PPT 추출 — 실행 폼 + 추출 현황(폴더 파일 수 vs 실제로 들어간 파일, 안 된 파일과 이유, 2026-10-01).
 * 예전 AdminModal 가운데·아래(2026-10-23 페이지로)
 */
const AdminExtractSection = ({ extractJob, initialSelected }: Props) => {
  const vm = useAdminExtractViewModel(extractJob, initialSelected);
  const { mode, targets, selectedFiles, locked } = vm;

  return (
    <div className={styles.groups}>
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
                className={`${styles.segBtn} ${targets.includes(t) ? styles.segActive : ''}`}
                onClick={() => vm.toggleTarget(t)}
                disabled={locked}
              >{EXTRACT_TARGET_LABEL[t]}</Button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>방식</span>
          <div className={styles.segment}>
            {PICK_MODES.map(m => (
              <Button key={m} variant="ghost" size="sm"
                className={`${styles.segBtn} ${mode === m ? styles.segActive : ''}`}
                onClick={() => vm.setMode(m)}
                disabled={locked || DISABLED_MODES.has(m)}
                title={DISABLED_MODES.has(m) ? '지금은 쓰지 않는 방식 — 증분·초기화를 쓰세요' : undefined}
              >{EXTRACT_MODE_INFO[m].label}</Button>
            ))}
          </div>
        </div>

        {/* 선택된 방식 설명 — 설명 3개를 한 칸에 겹쳐 두고 선택된 것만 보이게.
            칸 높이가 항상 가장 긴 설명 기준이라 방식을 바꿔도 화면 높이가 출렁이지 않음 */}
        <div className={styles.hintStack}>
          {PICK_MODES.map(m => (
            <span key={m} className={`${styles.hint} ${m === mode ? '' : styles.hintHidden}`}>
              {EXTRACT_MODE_INFO[m].desc}
            </span>
          ))}
        </div>

        {/* 고르는 표가 나타날 때 아래에서 살짝 올라오며 등장(swapIn, index.css) — 2026-10-23 애니메이션이 빠졌다는 요청 */}
        {mode === 'selected' && (
          <div className="swapIn">
            <ExtractFilePicker selected={selectedFiles} onChange={vm.setSelectedFiles}
              targets={targets} disabled={locked} />
          </div>
        )}

        {/* KPI 추출은 스킵 로직 자체가 없어 매번 전량 재파싱 — 방식 토글이 안 먹힘을 알림(자리 고정) */}
        <span className={`${styles.hint} ${targets.includes('kpi') && mode !== 'selected' ? '' : styles.hintHidden}`}>
          KPI는 매번 전체 재처리라 방식 선택과 무관합니다{targets.includes('finance') ? ' (재무에만 적용)' : ''}
        </span>

        <div className={styles.actions}>
          <Button
            variant={mode === 'reset' ? 'danger' : 'primary'}
            size="sm"
            loading={locked}
            disabled={targets.length === 0 || locked || (mode === 'selected' && selectedFiles.length === 0)}
            onClick={vm.run}
          >
            {extractJob.isRunning ? '추출 중…' : mode === 'selected' ? `선택한 ${selectedFiles.length}개 다시 추출` : '실행'}
          </Button>
          {/* 중지 — wb.save()가 파일 처리 루프 안에서 거의 안 불려서 대부분 안전하지만
              100% 보장은 아님(app.py api_extract_cancel 주석 참고). 확인창 거친 뒤 중지 */}
          {extractJob.isRunning && (
            <Button variant="danger" size="sm" loading={extractJob.isCancelling} onClick={vm.cancel}>
              중지
            </Button>
          )}
        </div>

        {extractJob.isRunning && extractJob.status?.started_at && (
          <span className={styles.result}>
            {extractJob.status.started_by ? `${extractJob.status.started_by} · ` : ''}
            {extractJob.status.started_at} 시작 — 이 페이지를 떠나도 계속 진행됩니다
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
        onRetryFailed={vm.retryFailed} retryDisabled={locked} />
    </div>
  );
};

export default AdminExtractSection;
