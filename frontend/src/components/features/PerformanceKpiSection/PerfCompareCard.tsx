import type { PerfCompareCardData } from '@/hooks/viewmodels/usePerformanceViewModel';
import styles from './PerfCompareCard.module.css';

/**
 * 계획·추정의 상대 차이(rel, 0~1) → 두 막대의 높이 간격(gap, 0~1).
 * 차이가 작을수록 더 크게 증폭하되(구간별 기울기 = 사실상 배수),
 * 구간을 끊어 배수만 곱하면 경계에서 "차이가 더 큰데 막대는 더 좁아지는" 역전이 생기므로
 * 앞 구간 끝값에서 이어받는 꺾은선으로 구성해 단조 증가를 보장한다.
 *   [상대 차이, 간격] — 기울기가 클수록 그 구간의 증폭 배수가 큼
 */
const GAP_CURVE: readonly (readonly [number, number])[] = [
  [0,    0   ],   // 값이 같으면 간격 없음
  [0.02, 0.50],   // ~2%  차이: 기울기 25 — 아주 작은 차이도 확 벌림
  [0.10, 0.70],   // ~10% 차이: 기울기 2.5
  [0.35, 0.85],   // ~35% 차이: 기울기 0.6
  [1,    0.92],   // 그 이상은 거의 포화 (사실상 선형)
];

const gapFor = (rel: number): number => {
  for (let i = 1; i < GAP_CURVE.length; i++) {
    const [x0, y0] = GAP_CURVE[i - 1];
    const [x1, y1] = GAP_CURVE[i];
    if (rel <= x1) return y0 + ((rel - x0) / (x1 - x0)) * (y1 - y0);
  }
  return GAP_CURVE[GAP_CURVE.length - 1][1];
};

/** 계획 → 추정(연간) 두 값 비교 카드 — 매출·원가·매출이익. 미니 2막대 그래프 포함(배경 스파크라인 없음) */
const PerfCompareCard = ({ card }: { card: PerfCompareCardData }) => {
  // 막대 높이는 값에 선형 비례가 아니라 "차이를 보여주는" 스케일.
  // 0 기준 선형이면 계획·추정이 가까울수록(대부분의 실제 데이터) 높이차가 1~3%p라
  // 사실상 구분이 안 됨(19.1 / 18.8 → 98% vs 100%).
  // → 큰 쪽은 항상 100%, 작은 쪽은 GAP_CURVE(차이가 작을수록 큰 배수로 증폭)만큼 내려감.
  //   값이 같으면 둘 다 100%, 차이가 클수록 간격도 커지므로 대소·동일 여부는 왜곡 없음.
  //   정확한 수치는 바로 옆 텍스트에 그대로 있으니 이 막대는 보조 지표 역할.
  const planAbs = Math.abs(card.planNum);
  const estAbs  = Math.abs(card.estNum);
  const lo  = Math.min(planAbs, estAbs);
  const hi  = Math.max(planAbs, estAbs);
  const rel = hi > 0 ? (hi - lo) / hi : 0;   // 상대 차이 0~1
  const gap = gapFor(rel);                   // 시각적 간격 0~0.92
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
