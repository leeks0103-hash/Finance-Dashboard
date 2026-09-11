import { Sparkline } from '@/components/ui/Sparkline';
import type { PerfCompareCardData } from '@/hooks/viewmodels/usePerformanceViewModel';
import styles from './PerfCompareCard.module.css';

/** 계획 → 추정(연간) 두 값 비교 카드 — 매출·원가·매출이익. 미니 2막대 그래프 + 값 2개짜리 스파크라인 포함 */
const PerfCompareCard = ({ card }: { card: PerfCompareCardData }) => {
  const max     = Math.max(Math.abs(card.planNum), Math.abs(card.estNum), 1);
  const planH   = `${Math.round((Math.abs(card.planNum) / max) * 65)}%`;  // 계획: 최대 65%
  const estH    = `${Math.round((Math.abs(card.estNum)  / max) * 100)}%`; // 추정: 최대 100%

  return (
    <div className={`${styles.card} ${styles[card.accent]}`}>
      {/* 값이 2개(계획·추정)라 스파크라인도 2개 — 각자 부호(양/음)에 따라 상승·하강 곡선 */}
      <div className={styles.sparkPair} aria-hidden>
        <Sparkline up={card.planNum >= 0} className={`${styles.spark} ${styles.sparkPlan}`} />
        <Sparkline up={card.estNum  >= 0} className={`${styles.spark} ${styles.sparkEst}`} />
      </div>

      {/* KpiCard 헤더 행과 같은 위치 — 라벨 좌측, 증감 배지 우측 */}
      <div className={styles.header}>
        <span className={styles.label}>{card.label}</span>
        <span className={`${styles.diff} ${card.diffUp ? styles.up : styles.down}`}>
          {card.diffUp ? '▲' : '▼'} {card.diffStr}
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.values}>
          <div className={styles.pair}>
            <span className={styles.plan}>{card.planStr}</span>
            <span className={styles.slash}>/</span>
            <span className={styles.est}>{card.estStr}</span>
          </div>
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
