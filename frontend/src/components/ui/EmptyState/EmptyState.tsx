import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface Props {
  icon?:        string;
  title?:       string;
  description?: string;
  action?:      ReactNode;
}

const EmptyState = ({
  icon = '📭',
  title = '데이터가 없습니다',
  description = '필터 조건을 변경하거나 데이터를 확인해 주세요.',
  action,
}: Props) => (
  <div className={styles.wrap}>
    <span className={styles.icon} aria-hidden>{icon}</span>
    <strong className={styles.title}>{title}</strong>
    <p className={styles.desc}>{description}</p>
    {action && <div className={styles.action}>{action}</div>}
  </div>
);

export default EmptyState;
