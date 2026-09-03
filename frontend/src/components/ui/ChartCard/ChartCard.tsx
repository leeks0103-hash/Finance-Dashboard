import { Children, type ReactNode } from 'react';
import styles from './ChartCard.module.css';

// 마커 컴포넌트 — 실제 렌더링(클래스·배치)은 Root가 전담. 호출부 가독성을 위한 자리 표시자.
const Title = ({ children }: { children: ReactNode }) => <>{children}</>;
const Body  = ({ children }: { children: ReactNode }) => <>{children}</>;

interface RootProps {
  /** 항상 <ChartCard.Title>, <ChartCard.Body> 순서로 정확히 2개 — Root가 위치로만 구분(타입 비교 없음) */
  children: ReactNode;
  /** true(기본) — 제목이 카드 테두리 안에 작게 표시. false — 카드 바깥 위에 제목이 표시 */
  compact?: boolean;
}

const Root = ({ children, compact = true }: RootProps) => {
  const [title, body] = Children.toArray(children);

  if (compact) {
    return (
      <div className={styles.group}>
        <div className={styles.root}>
          <div className={styles.titleCompact}>{title}</div>
          <div className={styles.body}>{body}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.group}>
      <div className={styles.title}>{title}</div>
      <div className={styles.root}>
        <div className={styles.body}>{body}</div>
      </div>
    </div>
  );
};

export const ChartCard = Object.assign(Root, { Title, Body });
