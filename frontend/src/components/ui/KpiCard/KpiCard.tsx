import { useId } from 'react';
import type { KpiAccent } from '@/types';
import styles from './KpiCard.module.css';

interface Props {
  label:    string;
  value:    string;
  accent:   KpiAccent;
  sub?:     string;
  trend?:   string | null;
  trendUp?: boolean;
}

/**
 * 스파크라인 — polyline(직각) + 풀 그라디언트 fill
 * 실제 주가 차트처럼 다양한 피크·밸리가 있는 뾰족한 형태
 */
const UP_POINTS   = "0,34 8,28 14,31 22,22 28,26 36,14 42,19 50,10 56,15 64,6 70,11 78,3 86,7 90,2";
const DOWN_POINTS = "0,2  8,8  14,5  22,14 28,10 36,22 42,17 50,26 56,21 64,30 70,25 78,33 86,29 90,34";

const Sparkline = ({ up, gradId }: { up: boolean; gradId: string }) => {
  const pts = up ? UP_POINTS : DOWN_POINTS;

  return (
    <svg
      className={styles.spark}
      viewBox="0 0 90 36"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="75%"  stopColor="currentColor" stopOpacity="0.12" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0"    />
        </linearGradient>
      </defs>

      {/* 그라디언트 fill — polyline을 직접 path로 */}
      <polygon
        points={`${pts} 90,36 0,36`}
        fill={`url(#${gradId})`}
      />

      {/* 뾰족한 선 */}
      <polyline
        points={pts}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
};

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

const KpiCard = ({ label, value, accent, sub, trend, trendUp = false }: Props) => {
  const uid   = useId();
  const gradId = `spark-grad-${uid.replace(/:/g, '')}`;

  return (
    <div className={`${styles.card} ${styles[accent]}`}>
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
        <Sparkline up={trendUp} gradId={gradId} />
      </div>
    </div>
  );
};

export default KpiCard;
