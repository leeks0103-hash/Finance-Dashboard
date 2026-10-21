import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import CopyText from '@/components/ui/CopyText/CopyText';
import { usePresence } from '@/components/ui/useAnimatedClose';
import { useDismissExtractRequest, useExtractRequests } from '@/hooks/useExtractRequests';
import styles from './Navbar.module.css';

interface Props {
  /** 요청 파일들을 미리 고른 채 관리자 기능 창(선택 추출)을 엶 */
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

  const shown = items.length > 0;
  return (
    <div className={`${styles.health} ${shown ? styles.healthShown : ''}`} ref={ref} aria-hidden={!shown}>
      <Button unstyled className={`${styles.healthBtn} ${styles.requestBtn}`}
        onClick={() => setOpen(v => !v)} tabIndex={shown ? 0 : -1}
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
              <span className={styles.healthHeaderSub}>원본을 고쳤다며 다시 추출을 요청한 파일 — 다시 추출되면 저절로 빠짐</span>
            </div>
            <ul className={styles.healthList}>
              {items.map(it => (
                <li key={it.file} className={styles.healthItem}>
                  <div className={styles.healthFileRow}>
                    <CopyText text={it.file} className={styles.healthFile} />
                    <Button variant="ghost" size="sm" onClick={() => dismiss(it.file)} title="추출 없이 이 요청 지우기">지우기</Button>
                  </div>
                  <div className={styles.healthCodes}>
                    <span className={styles.healthDesc}>
                      {it.at}{it.by ? ` · ${it.by}` : ''} 요청
                      {' · '}
                      {it.changed === true ? <b className={styles.requestChanged}>원본 바뀜</b>
                        : it.changed === false ? <b className={styles.requestSame}>마지막 추출 뒤 원본 안 바뀜(저장 안 했을 수 있음)</b>
                        : '원본 수정 시각 모름'}
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
