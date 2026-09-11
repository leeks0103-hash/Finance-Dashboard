import type { PerfCompareCardData } from '@/hooks/viewmodels/usePerformanceViewModel';
import styles from './PerfCompareCard.module.css';

/** 계획 → 추정(연간) 두 값 비교 카드 — 매출·원가·매출이익. 미니 2막대 그래프 포함(배경 스파크라인 없음) */
const PerfCompareCard = ({ card }: { card: PerfCompareCardData }) => {
  // 카드 자기 자신의 계획/추정 중 큰 값 기준으로 스케일 — 매출 카드가 항상 다른 카드보다
  // 절대값이 커서 3장 공통 스케일을 쓰면 매출의 계획·추정 막대가 둘 다 항상 최상단 부근에
  // 붙어 있어(barMax≈매출 자신의 값) 계획-추정 차이가 커도 시각적으로 거의 안 보였음
  const max  = Math.max(Math.abs(card.planNum), Math.abs(card.estNum), 1);
  const planH = `${Math.round((Math.abs(card.planNum) / max) * 100)}%`;
  const estH  = `${Math.round((Math.abs(card.estNum)  / max) * 100)}%`;

  return (
    <div className={`${styles.card} ${styles[card.accent]}`}>
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
