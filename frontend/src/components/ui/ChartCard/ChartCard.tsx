import { Children, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useEscToClose } from '@/hooks/useEscToClose';
import styles from './ChartCard.module.css';

// 마커 컴포넌트 — 실제 렌더링(클래스·배치)은 Root가 전담. 호출부 가독성을 위한 자리 표시자.
const Title = ({ children }: { children: ReactNode }) => <>{children}</>;
const Body  = ({ children }: { children: ReactNode }) => <>{children}</>;

interface RootProps {
  /** 항상 <ChartCard.Title>, <ChartCard.Body> 순서로 정확히 2개 — Root가 위치로만 구분(타입 비교 없음) */
  children: ReactNode;
  /** true(기본) — 제목이 카드 테두리 안에 작게 표시. false — 카드 바깥 위에 제목이 표시 */
  compact?: boolean;
  /** true(기본) — 제목줄 우측에 확대 버튼 표시, 클릭 시 모달로 크게 보기 */
  expandable?: boolean;
}

const Root = ({ children, compact = true, expandable = true }: RootProps) => {
  const [title, body] = Children.toArray(children);
  const [expanded, setExpanded] = useState(false);

  // 모달 열림 동안 배경 스크롤 잠금 (스크롤바 폭 보정 포함 — 화면 튐 방지)
  useScrollLock(expanded);
  // ESC 닫기 — 모달을 겹쳐 열었을 땐 맨 위 것만 닫힌다
  useEscToClose(() => setExpanded(false), expanded);

  const titleRow = (className: string) => (
    <div className={className}>
      <div className={styles.titleContent}>{title}</div>
    </div>
  );

  // 확대 버튼 — 제목줄이 아니라 카드(.root) 우측 상단에 절대배치
  const expandButton = expandable && (
    <Button
      unstyled
      className={styles.expandBtn}
      onClick={() => setExpanded(true)}
      aria-label="차트 확대"
      title="크게 보기"
    >
      ⤢
    </Button>
  );

  // 카드와 같은 title/body를 그대로 재사용 — 모달 안에서는 더 큰 영역에 다시 그려진다
  const modal = expanded && createPortal(
    <div className={styles.modalOverlay} onClick={() => setExpanded(false)} role="presentation">
      <div
        className={styles.modalCard}
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div className={styles.titleContent}>{title}</div>
          <Button
            unstyled
            className={styles.modalClose}
            onClick={() => setExpanded(false)}
            aria-label="닫기"
          >
            ×
          </Button>
        </div>
        {/* chartcard-modal-body — 고정(비해시) 클래스. 페이지별 CSS 모듈이 "모달 안에서만"
            자기 차트 높이를 채우도록 :global()로 걸 수 있는 표식 (예: KpiPage.module.css) */}
        <div className={`${styles.modalBody} chartcard-modal-body`}>{body}</div>
      </div>
    </div>,
    document.body,
  );

  if (compact) {
    return (
      <div className={styles.group}>
        <div className={styles.root}>
          {expandButton}
          {titleRow(styles.titleCompact)}
          <div className={styles.body}>{body}</div>
        </div>
        {modal}
      </div>
    );
  }

  return (
    <div className={styles.group}>
      {titleRow(styles.title)}
      <div className={styles.root}>
        {expandButton}
        <div className={styles.body}>{body}</div>
      </div>
      {modal}
    </div>
  );
};

export const ChartCard = Object.assign(Root, { Title, Body });
