import styles from './KpiCard.module.css';

type Accent = 'brand' | 'profit' | 'loss' | 'warn' | 'purple';

interface Props {
  label:  string;
  value:  string;
  accent: Accent;
}

const KpiCard = ({ label, value, accent }: Props) => (
  <div className={`${styles.card} ${styles[accent]}`}>
    <div className={styles.label}>{label}</div>
    <div className={styles.value}>{value}</div>
  </div>
);

export default KpiCard;
