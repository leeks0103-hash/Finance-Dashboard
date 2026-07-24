import type { ReactNode } from 'react';
import styles from './InsightListCard.module.css';

type Variant = 'profit' | 'risk' | 'default';

const Root = ({ children, variant = 'default' }: { children: ReactNode; variant?: Variant }) => (
  <div className={`${styles.card} ${styles[variant]}`}>{children}</div>
);

const Title = ({ children }: { children: ReactNode }) => (
  <div className={styles.title}>{children}</div>
);

const Body = ({ children }: { children: ReactNode }) => (
  <div className={styles.body}>{children}</div>
);

export const InsightListCard = Object.assign(Root, { Title, Body });
