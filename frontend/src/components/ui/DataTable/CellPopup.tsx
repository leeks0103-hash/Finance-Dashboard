import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { useAnimatedClose } from '@/components/ui/useAnimatedClose';
import { FileOpenVisibleContext } from '@/components/ui/fileOpenContext';
import styles from './CellPopup.module.css';

interface PopupState {
  text:     string;
  copyable: boolean;
  onOpen?:  () => void;
  /** 클릭한 셀의 컬럼 이름 — 있으면 title prop보다 우선 */
  title?:   string;
}

interface Props {
  /** popup.title이 없을 때 쓰는 고정 제목(한 컬럼 전용 팝업 — 예: 미수사유) */
  title:   ReactNode;
  popup:   PopupState | null;
  copied:  boolean;
  onClose: () => void;
  onCopy:  () => void;
}

/** 셀 내용 팝업 포털 — DataTable·KpiRawTable 공용 */
export const CellPopup = ({ title, popup, copied, onClose, onCopy }: Props) => {
  const { closing, close } = useAnimatedClose(onClose);
  const canOpen = useContext(FileOpenVisibleContext);
  if (!popup) return null;
  const onOpen = canOpen ? popup.onOpen : undefined;

  return createPortal(
    <div className={`${styles.popupOverlay} ${closing ? 'closingOverlay' : ''}`} onClick={close}>
      <div className={`${styles.popupBox} ${closing ? 'closingPanel' : ''}`} onClick={e => e.stopPropagation()}>
        <div className={styles.popupHeader}>
          <span>{popup.title ?? title}</span>
          <Button variant="ghost" size="sm" className={styles.popupClose} onClick={close} aria-label="닫기">✕</Button>
        </div>
        {/* 내용 옆에 [복사] [↗ 바로가기] — 예전엔 본문 전체가 "클릭해서 복사" 영역이고 바로가기는 아래
            큰 버튼이었음(2026-09-29 버튼으로 통일, 바로가기 복구) */}
        <div className={styles.popupBody}>
          <span className={styles.popupText}>{popup.text}</span>
          {(popup.copyable || onOpen) && (
            <span className={styles.popupActions}>
              {popup.copyable && (
                <Button
                  unstyled
                  className={`${styles.iconBtn} ${copied ? styles.iconBtnDone : ''}`}
                  onClick={onCopy}
                  title={copied ? '복사됨' : '복사'}
                  aria-label={copied ? '복사됨' : '복사'}
                >
                  {copied ? (
                    <svg viewBox="0 0 16 16" aria-hidden><path d="M3 8.5l3 3 7-7" /></svg>
                  ) : (
                    <svg viewBox="0 0 16 16" aria-hidden><rect x="5" y="5" width="8.5" height="8.5" rx="1.5" /><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" /></svg>
                  )}
                </Button>
              )}
              {onOpen && (
                <Button unstyled className={styles.iconBtn} onClick={onOpen} title="바로가기" aria-label="바로가기">
                  <svg viewBox="0 0 16 16" aria-hidden><path d="M9 2.5h4.5V7" /><path d="M13.5 2.5 7 9" /><path d="M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" /></svg>
                </Button>
              )}
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
