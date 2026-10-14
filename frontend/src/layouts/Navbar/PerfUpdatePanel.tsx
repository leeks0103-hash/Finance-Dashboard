import { useRef, useState, type DragEvent } from 'react';
import { Button, Spinner } from '@/components/ui';
import { usePerfUpdateStatus } from '@/hooks/usePerfUpdateStatus';
import styles from './PerfUpdatePanel.module.css';

/** axios 오류 → 서버가 준 문구 */
const errText = (e: unknown): string => {
  const r = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
  return r || (e instanceof Error ? e.message : '알 수 없는 오류');
};

/**
 * 관리자 기능 > 실적현황 파일 자동 반영(2026-10-14).
 * 사람은 data/에 새 '사업계획 통합관리 파일'을 넣기만(여기로 끌어다 놓기 = 같은 일) — 서버가 열 맞추기(자동·H-chat)·계산식 검증 후
 * 통과하면 바로 반영, 실패하면 직전 파일로 계속 보여주고 이유를 여기에
 */
const PerfUpdatePanel = () => {
  const { status, isLoading, upload, retry, busy } = usePerfUpdateStatus();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const send = (file?: File | null) => {
    if (file && !busy) upload.mutate(file);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    send(e.dataTransfer.files?.[0]);
  };

  const failed = status && status.ok === false;
  const servingOther = failed && status.serving && status.serving !== status.file;

  return (
    <section className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.title}>실적현황 파일 자동 반영</span>
        {status?.serving && (
          <span className={styles.serving} title="지금 대시보드가 보여주는 파일">
            표시 중: {status.serving_sheet ?? ''}
          </span>
        )}
      </div>

      <div
        className={`${styles.drop} ${over ? styles.dropOver : ''} ${busy ? styles.dropBusy : ''}`}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        {busy ? (
          <span className={styles.busy}><Spinner size="sm" fullPage={false} label="" /> 열 맞추기·계산식 검증 중… (H-chat 포함 1분 안팎)</span>
        ) : (
          <>
            <span>새 실적 엑셀을 여기로 끌어다 놓거나</span>
            <Button variant="primary" size="sm" onClick={() => inputRef.current?.click()}>파일 선택</Button>
            <span className={styles.dropHint}>
              data 폴더에 직접 넣어도 똑같이 반영됩니다 · 파일 이름에 '사업계획 통합관리 파일'
            </span>
          </>
        )}
        <input ref={inputRef} type="file" accept=".xlsx,.xlsb" hidden
          onChange={e => { send(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {upload.isError && <div className={styles.error}>올리지 못했습니다 — {errText(upload.error)}</div>}

      {isLoading && <div className={styles.muted}>상태 불러오는 중…</div>}
      {status?.file && (
        <div className={`${styles.result} ${failed ? styles.resultFail : ''}`}>
          <div className={styles.resultHead}>
            <span className={`${styles.badge} ${failed ? styles.badgeFail : styles.badgeOk}`}>
              {failed ? '반영 안 됨' : '반영됨'}
            </span>
            <span className={styles.file} title={status.file}>{status.file}</span>
            <span className={styles.muted}>{status.checked_at}</span>
          </div>
          <div className={styles.meta}>
            {status.sheet && <span>시트 {status.sheet}</span>}
            {status.method && <span>열 매핑: {status.method}</span>}
          </div>

          {failed && (
            <div className={styles.error}>
              {status.error}
              {servingOther && <div className={styles.muted}>대시보드는 직전 파일({status.serving})로 계속 표시 중입니다</div>}
              <Button variant="ghost" size="sm" className={styles.retry} loading={retry.isPending} disabled={busy}
                onClick={() => retry.mutate()}>다시 시도</Button>
            </div>
          )}

          {status.summary && <p className={styles.summary}>{status.summary}</p>}

          {!!status.changes?.length && (
            <ul className={styles.changes}>
              {status.changes.map(c => <li key={c}>{c}</li>)}
            </ul>
          )}

          {!!status.checks?.length && (
            <div className={styles.checks}>
              {status.checks.map(c => (
                <span key={c.name} className={`${styles.check} ${c.ok ? '' : styles.checkFail}`} title={c.name}>
                  <span className={styles.checkMark}>{c.ok ? '✓' : '✕'}</span>
                  <span className={styles.checkName}>{c.name}</span>
                  <span className={styles.checkRate}>{c.rate}%</span>
                </span>
              ))}
            </div>
          )}

          {status.totals && (
            <div className={styles.totals}>
              {Object.entries(status.totals).map(([k, v]) => (
                <span key={k}><b>{v.toLocaleString()}</b>{k.includes('프로젝트') ? '건' : '억'} {k}</span>
              ))}
            </div>
          )}
        </div>
      )}
      {!!status?.files?.length && (
        <div className={styles.muted} title={status.files.join('\n')}>
          data 폴더 실적 파일 {status.files.length}개 — 가장 최신(파일명 날짜 기준)을 씁니다
        </div>
      )}
    </section>
  );
};

export default PerfUpdatePanel;
