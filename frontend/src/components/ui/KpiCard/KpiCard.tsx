import type { KpiAccent } from '@/types';
import { Sparkline } from '@/components/ui/Sparkline';
import styles from './KpiCard.module.css';

interface Props {
  label:    string;
  value:    string;
  accent:   KpiAccent;
  sub?:     string;
  trend?:   string | null;
  trendUp?: boolean;
  /** 추가 클래스 — 다른 카드와 나란히 놓일 때 그 화면 쪽에서만 크기 등을 보정하려는 용도.
   *  KpiCard 자체 스타일은 그대로 두고 바깥에서만 덧씌운다 */
  className?: string;
}

/** 배경 대형 아이콘 — 은은한 방향 화살표 */
const BgIcon = ({ up }: { up: boolean }) => (
  <svg
    className={styles.bgIcon}
    viewBox="0 0 60 60"
    fill="none"
    aria-hidden
  >
    {up ? (
      /* ↗ 대각 화살표 */
      <path
        d="M12 48 L48 12 M30 12 L48 12 L48 30"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ) : (
      /* ↘ 대각 화살표 */
      <path
        d="M12 12 L48 48 M30 48 L48 48 L48 30"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
  </svg>
);

const KpiCard = ({ label, value, accent, sub, trend, trendUp = false, className }: Props) => {
  return (
    <div className={`${styles.card} ${styles[accent]}${className ? ` ${className}` : ''}`}>
      {/* 배경 아이콘 (은은하게) */}
      <BgIcon up={trendUp} />

      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {trend && (
          <span className={`${styles.badge} ${trendUp ? styles.up : styles.down}`}>
            {trendUp ? '▲' : '▼'} {trend}
          </span>
        )}
      </div>
      <div className={styles.value}>{value}</div>
      {sub && <div className={styles.sub}>{sub}</div>}
      {/* 스파크라인 — flat 카드에서 은은한 배경 그래프 */}
      <div className={styles.sparkWrap}>
        <Sparkline up={trendUp} className={styles.spark} />
      </div>
    </div>
  );
};

export default KpiCard;
