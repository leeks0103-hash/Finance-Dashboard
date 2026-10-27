import { Children, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { useScrollLock } from '@/components/ui/useScrollLock';
import { useEscToClose } from '@/components/ui/useEscToClose';
import { useAnimatedClose } from '@/components/ui/useAnimatedClose';
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
  /** 모달 확대 시 body 대신 렌더링할 커스텀 콘텐츠 (미지정 시 body 그대로) */
  modalContent?: ReactNode;
  /** 확대 모달 높이 직접 지정(예: "90vh") — 미지정 시 기본값(min(820px, 88vh)) 그대로.
   *  차트+표처럼 기본 모달이 좁아 스크롤이 생기는 특정 카드에서만 opt-in */
  modalHeight?: string;
  /** 제목줄(titleCompact/title)에서 titleContent 옆(오른쪽)에 놓을 자식 — 예: 범례. 제목줄이 space-between이라 양 끝으로 갈라진다. 확대 모달 헤더에는 안 나옴 */
  titleAside?: ReactNode;
  /** true — 제목줄을 아예 안 그리고 안쪽 여백을 줄여 낮은 카드로(제목 없는 한 줄짜리 카드, 2026-10-27). compact일 때만 적용 */
  dense?: boolean;
  /** 그래프(body)만 카드 좌우 안쪽 여백(24px) 쪽으로 이만큼(px) 넓힘 — 제목은 그대로, 그래프가 카드 가장자리에 더 붙음(2026-10-27). compact일 때만 */
  bodyBleedX?: number;
}

// 확대 모달 퇴장 길이 — ChartCard.module.css .modalOverlay.closing과 맞출 것
const CLOSE_MS = 240;

const Root = ({ children, compact = true, expandable = true, modalContent, modalHeight, titleAside, dense = false, bodyBleedX = 0 }: RootProps) => {
  const [title, body] = Children.toArray(children);
  const [expanded, setExpanded] = useState(false);

  // 모달 열림 동안 배경 스크롤 잠금 (스크롤바 폭 보정 포함 — 화면 튐 방지)
  useScrollLock(expanded);
  // ESC 닫기 — 모달을 겹쳐 열었을 땐 맨 위 것만 닫힌다
  const { closing, close } = useAnimatedClose(() => setExpanded(false), CLOSE_MS);
  useEscToClose(close, expanded);

  const titleRow = (className: string) => (
    <div className={className}>
      <div className={styles.titleContent}>{title}</div>
      {titleAside}
    </div>
  );

  // 확대 버튼 — 제목줄이 아니라 카드(.root) 우측 상단에 절대배치
  // [확대 버튼 전부 주석 처리 — 2026-10-23 요청] 복구하려면 아래 주석 블록을 풀고 `const expandButton = null;` 줄을 지울 것
  // (모달·expandable prop·CSS는 그대로 남김. 같은 이유로 CostBreakdownModal·FinMismatch의 ⤢ 버튼, ChartCard.test의 확대 테스트도 주석/skip)
  const expandButton = null;
  void expandable;
  // const expandButton = expandable && (
  //   <Button
  //     unstyled
  //     className={styles.expandBtn}
  //     onClick={() => setExpanded(true)}
  //     aria-label="차트 확대"
  //     title="크게 보기"
  //   >
  //     ⤢
  //   </Button>
  // );

  // 카드와 같은 title/body를 그대로 재사용 — 모달 안에서는 더 큰 영역에 다시 그려진다
  const modal = expanded && createPortal(
    <div className={`${styles.modalOverlay} ${closing ? styles.closing : ''}`} onClick={close} role="presentation">
      <div
        className={`${styles.modalCard} ${closing ? styles.closing : ''}`}
        style={modalHeight ? { height: modalHeight } : undefined}
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <div className={styles.titleContent}>{title}</div>
          <Button
            unstyled
            className={styles.modalClose}
            onClick={close}
            aria-label="닫기"
          >
            ×
          </Button>
        </div>
        {/* chartcard-modal-body — 고정(비해시) 클래스. 페이지별 CSS 모듈이 "모달 안에서만"
            자기 차트 높이를 채우도록 :global()로 걸 수 있는 표식 (예: KpiPage.module.css) */}
        <div className={`${styles.modalBody} chartcard-modal-body`}>{modalContent ?? body}</div>
      </div>
    </div>,
    document.body,
  );

  if (compact) {
    return (
      <div className={styles.group}>
        <div className={dense ? `${styles.root} ${styles.rootDense}` : styles.root}>
          {expandButton}
          {!dense && titleRow(styles.titleCompact)}
          <div className={styles.body} style={bodyBleedX ? { marginLeft: -bodyBleedX, marginRight: -bodyBleedX } : undefined}>{body}</div>
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
