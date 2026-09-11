import { Sparkline } from '@/components/ui/Sparkline';
import type { PerfCompareCardData } from '@/hooks/viewmodels/usePerformanceViewModel';
import styles from './PerfCompareCard.module.css';

/** 계획 → 추정(연간) 두 값 비교 카드 — 매출·원가·매출이익. 미니 2막대 그래프 + 배경 스파크라인 포함 */
const PerfCompareCard = ({ card }: { card: PerfCompareCardData }) => {
  // 매출/원가/매출이익 3장 공통 기준(barMax)으로 스케일 — 카드끼리도 크기 비교가 되도록
  // (카드마다 따로 스케일하면 계획이 항상 100%로 찍혀 세 카드 막대가 다 똑같아 보였음)
  const planH = `${Math.round((Math.abs(card.planNum) / card.barMax) * 100)}%`;
  const estH  = `${Math.round((Math.abs(card.estNum)  / card.barMax) * 100)}%`;

  return (
    <div className={`${styles.card} ${styles[card.accent]}`}>
      {/* KpiCard와 같은 배경 스파크라인 — 막대그래프 뒤로(z-index) */}
      <div className={styles.sparkWrap}>
        <Sparkline up={card.diffUp} className={styles.spark} />
      </div>

      <div className={styles.header}>
        <span className={styles.label}>{card.label}</span>
        <span className={`${styles.diff} ${card.diffUp ? styles.up : styles.down}`}>
          {card.diffUp ? '▲' : '▼'} {card.diffStr}
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.values}>
          <div className={styles.planRow}>
            <span className={styles.plan}>{card.planStr}</span>
            <span className={styles.slash}>/</span>
          </div>
          <span className={styles.est}>{card.estStr}</span>
        </div>

        <div className={styles.bars} aria-hidden>
          <div className={styles.barCol}>
            <div className={`${styles.bar} ${styles.barPlan}`} style={{ height: planH }} />
            <span className={styles.barCap}>계획</span>
          </div>
          <div className={styles.barCol}>
            <div className={`${styles.bar} ${styles.barEst}`} style={{ height: estH }} />
            <span className={styles.barCap}>추정</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerfCompareCard;
