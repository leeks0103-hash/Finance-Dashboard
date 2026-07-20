import styles from './EmptyState.module.css';

interface Props {
  icon?: string;
  title?: string;
  description?: string;
}

const EmptyState = ({
  icon = '📭',
  title = '데이터가 없습니다',
  description = '필터 조건을 변경하거나 데이터를 확인해 주세요.',
}: Props) => (
  <div className={styles.wrap}>
    <span className={styles.icon}>{icon}</span>
    <strong className={styles.title}>{title}</strong>
    <p className={styles.desc}>{description}</p>
  </div>
);

export default EmptyState;
