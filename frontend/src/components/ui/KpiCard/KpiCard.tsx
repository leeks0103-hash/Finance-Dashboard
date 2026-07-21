import styles from './KpiCard.module.css';

type Accent = 'brand' | 'profit' | 'loss' | 'warn' | 'purple';

interface Props {
  label: string;
  value: string;
  icon: string;
  accent: Accent;
}

const KpiCard = ({ label, value, icon, accent }: Props) => (
  <div className={`${styles.card} ${styles[accent]}`}>
    <div className={styles.label}>{icon} {label}</div>
    <div className={styles.value}>{value}</div>
  </div>
);

export default KpiCard;
