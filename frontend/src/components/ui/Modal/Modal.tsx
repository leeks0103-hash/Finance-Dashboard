import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { useScrollLock } from '@/components/ui/useScrollLock';
import { useEscToClose } from '@/components/ui/useEscToClose';
import { useAnimatedClose } from '@/components/ui/useAnimatedClose';
import styles from './Modal.module.css';

interface ShellProps {
  onClose: () => void;
  /** 패널 폭 (기본 920px) — 화면보다 넓으면 화면 폭까지만 */
  width?: number | string;
  /** 패널 클래스 — 모달별 차이는 여기서 --modal-* 변수로만 (Modal.module.css 머리말 참고) */
  className?: string;
  overlayClassName?: string;
  /** 닫기(퇴장 애니메이션 포함)가 필요한 내용이면 함수로 받기 */
  children: ReactNode | ((close: () => void) => ReactNode);
}

/**
 * 모달 뼈대 — 포털 · 배경 클릭 닫기 · 스크롤 잠금 · ESC · 퇴장 애니메이션.
 * 헤더 모양이 표준(제목+닫기)과 다를 때만 직접 쓰고, 보통은 Modal을 쓴다.
 */
export const ModalShell = ({ onClose, width, className, overlayClassName, children }: ShellProps) => {
  useScrollLock();
  const { closing, close } = useAnimatedClose(onClose);
  useEscToClose(close);

  return createPortal(
    <div
      className={`${styles.overlay} ${overlayClassName ?? ''} ${closing ? 'closingOverlay' : ''}`}
      onClick={close}
      role="presentation"
    >
      <div
        className={`${styles.modal} ${className ?? ''} ${closing ? 'closingPanel' : ''}`}
        style={width !== undefined ? { width } : undefined}
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        {typeof children === 'function' ? children(close) : children}
      </div>
    </div>,
    document.body,
  );
};

/** 닫기 × 버튼 — ModalShell로 헤더를 직접 만들 때도 같은 모양으로 */
export const ModalCloseButton = ({ onClick, className }: { onClick: () => void; className?: string }) => (
  <Button unstyled className={`${styles.close} ${className ?? ''}`} onClick={onClick} aria-label="닫기">×</Button>
);

interface ModalProps extends Omit<ShellProps, 'children'> {
  title: ReactNode;
  /** 제목 아래 한 줄 설명 — 배지는 ModalBadge */
  sub?: ReactNode;
  /** 본문 아래 고정 영역(스크롤 안 됨) */
  footer?: ReactNode;
  children: ReactNode;
}

/** 표준 모달 — 제목·부제·닫기 헤더 + 스크롤 본문 (+ 선택 푸터) */
export const Modal = ({ title, sub, footer, children, ...shell }: ModalProps) => (
  <ModalShell {...shell}>
    {close => (
      <>
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <h3 className={styles.title}>{title}</h3>
            {sub && <div className={styles.sub}>{sub}</div>}
          </div>
          <ModalCloseButton onClick={close} />
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </>
    )}
  </ModalShell>
);

/** 부제 줄의 알약 배지 */
export const ModalBadge = ({ children }: { children: ReactNode }) => (
  <span className={styles.badge}>{children}</span>
);
