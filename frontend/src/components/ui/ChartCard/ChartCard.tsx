import { Children, isValidElement, type ReactNode } from 'react';
import styles from './ChartCard.module.css';

const Title = ({ children, compact }: { children: ReactNode; compact?: boolean }) => (
  <div className={compact ? styles.titleCompact : styles.title}>{children}</div>
);

const Body = ({ children }: { children: ReactNode }) => (
  <div className={styles.body}>{children}</div>
);

// compact Title(기존 스타일)은 카드 안, 일반 Title은 카드 밖으로 분리
const Root = ({ children }: { children: ReactNode }) => {
  const all = Children.toArray(children);
  const outerTitles = all.filter(c => isValidElement(c) && c.type === Title && !(c.props as { compact?: boolean }).compact);
  const innerRest   = all.filter(c => !(isValidElement(c) && c.type === Title && !(c.props as { compact?: boolean }).compact));
  return (
    <div className={styles.group}>
      {outerTitles}
      <div className={styles.root}>{innerRest}</div>
    </div>
  );
};

export const ChartCard = Object.assign(Root, { Title, Body });
