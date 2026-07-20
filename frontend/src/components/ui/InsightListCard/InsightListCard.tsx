import type { ReactNode } from 'react';
import styles from './InsightListCard.module.css';

interface Props {
  title: string;
  children: ReactNode;
}

const InsightListCard = ({ title, children }: Props) => (
  <div className={styles.card}>
    <div className={styles.title}>{title}</div>
    <div className={styles.body}>{children}</div>
  </div>
);

export default InsightListCard;
