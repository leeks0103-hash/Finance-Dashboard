import type { PerfCompareCardData } from '@/hooks/viewmodels/usePerformanceViewModel';
import styles from './PerfCompareCard.module.css';

/** 계획 → 추정(연간) 두 값 비교 카드 — 매출·원가·매출이익. 미니 2막대 그래프 포함(배경 스파크라인 없음) */
const PerfCompareCard = ({ card }: { card: PerfCompareCardData }) => {
  // 0을 기준선으로 잡으면 계획·추정 값이 서로 가까울 때 막대 높이 차이가 몇 %p밖에
  // 안 나서 사실상 구분이 안 됨(예: 127.8 / 132.0 → 97% vs 100%, 1px 차이).
  // 기준선(0%)을 0 대신 "둘 중 작은 값의 93%"로 올려 실제 차이를 시각적으로 증폭
  //   → 위 예시가 68% vs 100%로 벌어져 한눈에 보임.
  // 값이 완전히 같으면 둘 다 100%로 나오고 차이가 클수록 더 벌어지므로 대소·동일 여부는
  // 왜곡되지 않음. 정확한 수치는 바로 옆에 텍스트로 그대로 있으니 이 막대는 보조 지표
  const planAbs = Math.abs(card.planNum);
  const estAbs  = Math.abs(card.estNum);
  const lo   = Math.min(planAbs, estAbs);
  const hi   = Math.max(planAbs, estAbs, 1);
  const base = lo * 0.93;
  const span = Math.max(hi - base, 1);
  const planH = `${Math.round(((planAbs - base) / span) * 100)}%`;
  const estH  = `${Math.round(((estAbs  - base) / span) * 100)}%`;

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
