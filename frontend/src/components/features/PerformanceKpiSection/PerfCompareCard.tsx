import type { PerfCompareCardData } from '@/hooks/viewmodels/usePerformanceViewModel';
import { splitValueUnit } from '@/utils/format';
import styles from './PerfCompareCard.module.css';

/** "137.0억원" → 숫자 칸(오른쪽 정렬 고정폭) + 단위로 분리 렌더링 — 계획/추정 자릿수가 달라도
    "억원" 단위가 항상 같은 자리에 오도록 (0.0억원 / 88.2억원처럼 자릿수 차가 클 때 특히 필요) */
const ValueUnit = ({ value, className }: { value: string; className: string }) => {
  const { num, unit } = splitValueUnit(value);
  return (
    <span className={className}>
      <span className={styles.numPart}>{num}</span>
      {unit && <span className={styles.unitPart}>{unit}</span>}
    </span>
  );
};

/** 계획 → 추정(연간) 두 값 비교 카드 — 매출·원가·매출이익. 미니 2막대 그래프 포함 */
const PerfCompareCard = ({ card }: { card: PerfCompareCardData }) => {
  // 막대 높이 = 실제 비율 그대로. 큰 값 100%, 작은 값은 (작은값/큰값)*100%
  const planAbs = Math.abs(card.planNum);
  const estAbs  = Math.abs(card.estNum);
  const hi = Math.max(planAbs, estAbs, 1);
  const planH = `${Math.round((planAbs / hi) * 100)}%`;
  const estH  = `${Math.round((estAbs  / hi) * 100)}%`;

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
            <ValueUnit value={card.planStr} className={styles.plan} />
            <span className={styles.slash}>/</span>
          </div>
          <ValueUnit value={card.estStr} className={styles.est} />
        </div>

        <div className={styles.bars} aria-hidden>
          <div className={styles.barCol}>
            {/* barTrack — 캡션을 뺀 "막대만의 영역". 이게 없으면 막대(height %)와 캡션이
                같은 flex 칸을 나눠 갖다가 100% 막대만 flex-shrink로 찌그러져서
                높이 차이가 사라짐 */}
            <div className={styles.barTrack}>
              <div className={`${styles.bar} ${styles.barPlan}`} style={{ height: planH }} />
            </div>
            <span className={styles.barCap}>계획</span>
          </div>
          <div className={styles.barCol}>
            <div className={styles.barTrack}>
              <div className={`${styles.bar} ${styles.barEst}`} style={{ height: estH }} />
            </div>
            <span className={styles.barCap}>추정</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerfCompareCard;
