import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import styles from './CellPopup.module.css';

interface PopupState {
  text:     string;
  copyable: boolean;
}

interface Props {
  title:   ReactNode;
  popup:   PopupState | null;
  copied:  boolean;
  onClose: () => void;
  onCopy:  () => void;
}

/** 셀 내용 팝업 포털 — DataTable·KpiRawTable 공용 */
export const CellPopup = ({ title, popup, copied, onClose, onCopy }: Props) => {
  if (!popup) return null;

  return createPortal(
    <div className={styles.popupOverlay} onClick={onClose}>
      <div className={styles.popupBox} onClick={e => e.stopPropagation()}>
        <div className={styles.popupHeader}>
          <span>{title}</span>
          <Button variant="ghost" size="sm" className={styles.popupClose} onClick={onClose} aria-label="닫기">✕</Button>
        </div>
        {popup.copyable ? (
          <div
            className={`${styles.popupBody} ${styles.popupBodyCopyable} ${copied ? styles.popupBodyCopied : ''}`}
            onClick={onCopy}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onCopy()}
          >
            <span>{popup.text}</span>
            <span className={styles.popupCopyHint}>{copied ? '✓ 복사됨' : '클릭해서 복사'}</span>
          </div>
        ) : (
          <div className={styles.popupBody}>{popup.text}</div>
        )}
      </div>
    </div>,
    document.body,
  );
};
