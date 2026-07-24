import type { KpiAccent } from '@/types';
import styles from './KpiCard.module.css';

interface Props {
  label:    string;
  value:    string;
  accent:   KpiAccent;
  trend?:   string | null;
  trendUp?: boolean;
}

/* 스파크라인: 초반 완만 → 중간 모멘텀 → 끝 방향 확정 (제어점 단조 유지) */
const UP_LINE   = "M 0,28 C 12,28 20,26 32,23 C 45,19 58,13 72,7 C 80,4 86,2 90,1";
const UP_FILL   = `${UP_LINE} L 90,36 L 0,36 Z`;
const DOWN_LINE = "M 0,8 C 12,8 20,10 32,13 C 45,17 58,23 72,29 C 80,32 86,34 90,35";
const DOWN_FILL = `${DOWN_LINE} L 90,0 L 0,0 Z`;

const Sparkline = ({ up }: { up: boolean }) => (
  <svg className={styles.spark} viewBox="0 0 90 36" fill="none" preserveAspectRatio="none">
    <path d={up ? UP_FILL : DOWN_FILL} fill="currentColor" fillOpacity="0.18" />
    <path d={up ? UP_LINE : DOWN_LINE}
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const KpiCard = ({ label, value, accent, trend, trendUp = false }: Props) => (
  <div className={`${styles.card} ${styles[accent]}`}>
    <div className={styles.header}>
      <span className={styles.label}>{label}</span>
      {trend && (
        <span className={`${styles.badge} ${trendUp ? styles.up : styles.down}`}>
          {trendUp ? '▲' : '▼'} {trend}
        </span>
      )}
    </div>
    <div className={styles.value}>{value}</div>
    <div className={styles.sparkWrap}>
      <Sparkline up={trendUp} />
    </div>
  </div>
);

export default KpiCard;
