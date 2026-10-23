import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import CopyText from '@/components/ui/CopyText/CopyText';
import { usePresence } from '@/components/ui/useAnimatedClose';
import { useDismissExtractRequest, useExtractRequests } from '@/hooks/useExtractRequests';
import styles from './Navbar.module.css';

interface Props {
  /** 요청 파일들을 미리 고른 채 PPT 추출 창(선택 방식)을 엶 */
  onExtract: (files: string[]) => void;
}

/**
 * PPT 업데이트(재추출) 요청 — 관리자에게만 헤더 노란 "!"(2026-10-21). 데이터 이상 빨간 "!"와 따로.
 * 사용자가 파일명 옆 '업데이트 요청'을 누르면 쌓이고, 다시 추출되면 서버가 저절로 지움
 */
const ExtractRequestBadge = ({ onExtract }: Props) => {
  const { data } = useExtractRequests();
  const dismiss = useDismissExtractRequest();
  const items = data?.items ?? [];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const drop = usePresence(open && items.length > 0);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // 요청 0건이면 안 그림(빨간 "!"와 같은 방식, 2026-10-21)
  if (items.length === 0) return null;
  return (
    <div className={styles.health} ref={ref}>
      <Button unstyled className={`${styles.healthBtn} ${styles.requestBtn}`}
        onClick={() => setOpen(v => !v)}
        aria-label={`업데이트 요청 ${items.length}건`} aria-expanded={open}
        title={`PPT 업데이트(다시 추출) 요청 ${items.length}건`}>
        !
      </Button>
      {drop.mounted && (
        <div className={`${styles.healthDropdown} ${drop.closing ? 'closingDrop' : ''}`}>
          <section className={`${styles.healthSection} ${styles.accentFinished}`}>
            <div className={styles.healthHeader}>
              <span className={styles.healthIcon}>↻</span>
              업데이트 요청 · {items.length}건
            </div>
            <ul className={styles.healthList}>
              {items.map(it => (
                <li key={it.file} className={styles.healthItem}>
                  <div className={styles.healthFileRow}>
                    <CopyText text={it.file} className={styles.healthFile} />
                    {/* 글자 버튼 대신 작은 둥근 ×(2026-10-22 — "지우기" 버튼이 투박하다는 의견) */}
                    <Button unstyled className={styles.requestDismiss} onClick={() => dismiss(it.file)}
                      title="추출 없이 이 요청 지우기" aria-label="이 요청 지우기">
                      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                    </Button>
                  </div>
                  <div className={styles.healthCodes}>
                    <span className={styles.healthDesc}>
                      {it.at}{it.by ? ` · ${it.by}` : ''} 요청
                      {' · '}
                      {it.changed === true ? <b className={styles.requestChanged}>원본이 바뀌었어요</b>
                        : it.changed === false ? <b className={styles.requestSame}>마지막 추출 뒤로 원본이 바뀌지 않았어요(저장을 안 하셨을 수 있어요)</b>
                        : '원본 수정 시각을 알 수 없어요'}
                      {it.modified ? ` (원본 ${it.modified}` : ''}{it.modified ? `${it.last_extracted ? ` · 추출 ${it.last_extracted}` : ''})` : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className={styles.requestFoot}>
              <Button variant="primary" size="sm" onClick={() => { setOpen(false); onExtract(items.map(i => i.file)); }}>
                {items.length}개 선택 추출로 열기
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default ExtractRequestBadge;
