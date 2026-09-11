import type { PerfCompareCardData } from '@/hooks/viewmodels/usePerformanceViewModel';
import styles from './PerfCompareCard.module.css';

/** 계획 → 추정(연간) 두 값 비교 카드 — 매출·원가·매출이익. 미니 2막대 그래프 포함(배경 스파크라인 없음) */
const PerfCompareCard = ({ card }: { card: PerfCompareCardData }) => {
  // 막대 높이는 값에 선형 비례가 아니라 "차이를 보여주는" 스케일.
  // 0 기준 선형이면 계획·추정이 가까울수록(대부분의 실제 데이터) 높이차가 1~3%p라
  // 사실상 구분이 안 됨(19.1 / 18.8 → 98% vs 100%).
  // → 큰 쪽은 항상 100%, 작은 쪽은 상대 차이에 따라 내려가되 차이가 아무리 작아도
  //   최소 32%p는 벌어지도록(최대 85%p). 값이 정확히 같으면 둘 다 100%.
  //   차이가 클수록 간격도 커지므로 대소·동일 여부는 왜곡되지 않고,
  //   정확한 수치는 바로 옆 텍스트에 그대로 있으니 이 막대는 보조 지표 역할.
  const planAbs = Math.abs(card.planNum);
  const estAbs  = Math.abs(card.estNum);
  const lo  = Math.min(planAbs, estAbs);
  const hi  = Math.max(planAbs, estAbs);
  const rel = hi > 0 ? (hi - lo) / hi : 0;                       // 상대 차이 0~1
  const gap = rel === 0 ? 0 : Math.min(0.85, 0.32 + rel * 2.5);  // 시각적 간격
  const hiH = hi > 0 ? '100%' : '0%';                            // 둘 다 0이면 막대도 비움
  const loH = hi > 0 ? `${Math.round((1 - gap) * 100)}%` : '0%';
  const planH = planAbs >= estAbs ? hiH : loH;
  const estH  = estAbs  >= planAbs ? hiH : loH;

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
