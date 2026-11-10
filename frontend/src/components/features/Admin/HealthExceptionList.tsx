import { Button, CopyText } from '@/components/ui';
import { useDataHealth, useDataHealthException } from '@/hooks/useDataHealth';
import { alertDialog, confirmDialog } from '@/utils/dialog';
import styles from './HealthExceptionList.module.css';

/**
 * 관리자 페이지 > PPT 추출 — "예외 처리한 데이터 이상"(2026-11-10).
 * 관리자가 빨간 "!" 목록에서 '예외 처리'한 파일은 모든 사람 화면의 "!"에서는 빠지지만, 데이터(이상의 내용)는 여기 그대로 남고
 * "관리자 예외 처리(임시)" 표시와 누가·언제 처리했는지가 붙음. [해제]하면 다시 "!"에 표시.
 * PPT가 고쳐져 이상의 내용이 바뀌면 서버가 저절로 풀어서 이 목록에서도 빠짐. 없으면 아무것도 안 그림.
 */
const HealthExceptionList = () => {
  const { data } = useDataHealth();
  const ex = useDataHealthException();
  const items = data?.excepted ?? [];
  if (items.length === 0) return null;

  const release = async (file: string) => {
    const ok = await confirmDialog('해제하면 이 이상이 다시 모든 사람 화면의 빨간 느낌표에 표시됩니다.', {
      title: '예외 처리를 해제할까요?', confirmText: '해제',
    });
    if (!ok) return;
    try {
      const r = await ex.set([file], false);
      if (!r.ok) await alertDialog(r.error ?? '해제하지 못했습니다', { error: true });
    } catch {
      await alertDialog('해제하지 못했습니다 — 잠시 뒤 다시 시도하세요', { error: true });
    }
  };

  return (
    <section className={styles.root} aria-label="예외 처리한 데이터 이상">
      <div className={styles.head}>
        <span className={styles.title}>예외 처리한 데이터 이상 · {items.length}건</span>
        <span className={styles.sub}>빨간 느낌표에서는 빠져 있고, 이상의 내용이 바뀌면 자동으로 다시 표시됩니다</span>
      </div>
      <ul className={styles.list}>
        {items.map(it => (
          <li key={it.file} className={styles.item}>
            <div className={styles.fileRow}>
              <CopyText text={it.file} className={styles.file} />
              <span className={styles.badge}
                title="관리자가 의도한 불일치로 보고 빨간 느낌표에서 뺐습니다. 해제하면 다시 표시됩니다">
                관리자 예외 처리 (임시)
              </span>
              <Button unstyled className={styles.release} onClick={() => release(it.file)} disabled={ex.pending}>
                해제
              </Button>
            </div>
            <ul className={styles.issues}>
              {it.issues.map(t => <li key={t}>{t}</li>)}
            </ul>
            <span className={styles.meta}>
              {it.by ? `${it.by} · ` : ''}{it.at.slice(0, 16)} 처리{it.reason ? ` · ${it.reason}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default HealthExceptionList;
