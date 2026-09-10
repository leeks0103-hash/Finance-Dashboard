import type { PerfCompareCardData } from '@/hooks/viewmodels/usePerformanceViewModel';
import styles from './PerfCompareCard.module.css';

/** 계획 → 추정(연간) 두 값 비교 카드 — 매출·원가·매출이익. 미니 2막대 그래프 포함 */
const PerfCompareCard = ({ card }: { card: PerfCompareCardData }) => {
  const max  = Math.max(Math.abs(card.planNum), Math.abs(card.estNum), 1);
  const hPct = (v: number) => `${Math.round((Math.abs(v) / max) * 100)}%`;

  return (
    <div className={`${styles.card} ${styles[card.accent]}`}>
      <div className={styles.label}>{card.label}</div>

      <div className={styles.body}>
        <div className={styles.values}>
          <div className={styles.pair}>
            <span className={styles.plan}>{card.planStr}</span>
            <span className={styles.arrow}>→</span>
            <span className={styles.est}>{card.estStr}</span>
          </div>
          <span className={`${styles.diff} ${card.diffUp ? styles.up : styles.down}`}>
            {card.diffUp ? '▲' : '▼'} {card.diffStr}
          </span>
        </div>

        <div className={styles.bars} aria-hidden>
          <div className={styles.barCol}>
            <div className={`${styles.bar} ${styles.barPlan}`} style={{ height: hPct(card.planNum) }} />
            <span className={styles.barCap}>계획</span>
          </div>
          <div className={styles.barCol}>
            <div className={`${styles.bar} ${styles.barEst}`} style={{ height: hPct(card.estNum) }} />
            <span className={styles.barCap}>추정</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerfCompareCard;
