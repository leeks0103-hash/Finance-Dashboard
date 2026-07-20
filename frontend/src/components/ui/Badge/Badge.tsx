import styles from './Badge.module.css';

type Variant = 'part' | 'stage' | 'profit' | 'loss';

interface Props { label: string; variant?: Variant; }

const Badge = ({ label, variant = 'part' }: Props) => (
  <span className={`${styles.badge} ${styles[variant]}`}>{label}</span>
);

export default Badge;
