import { DualSparkline } from '@/components/ui/Sparkline';
import type { PerfCompareCardData } from '@/hooks/viewmodels/usePerformanceViewModel';
import styles from './PerfCompareCard.module.css';

// accent → 실제 표시할 CSS 변수명 (추정값 스파크라인 색 — 계획값은 항상 muted)
const ACCENT_VAR: Record<PerfCompareCardData['accent'], string> = {
  brand: '--brand-mid', profit: '--profit', loss: '--loss', warn: '--warn', purple: '--purple',
};

/** 계획 → 추정(연간) 두 값 비교 카드 — 매출·원가·매출이익. 값 2개짜리 이어진 스파크라인 포함 */
const PerfCompareCard = ({ card }: { card: PerfCompareCardData }) => {
  return (
    <div className={`${styles.card} ${styles[card.accent]}`}>
      {/* 계획→추정 하나로 이어진 스파크라인 — 가운데서 색만 전환(계획 muted → 추정 accent) */}
      <div className={styles.sparkPair} aria-hidden>
        <DualSparkline
          leftUp={card.planNum >= 0}
          rightUp={card.estNum  >= 0}
          leftColor="var(--text-muted)"
          rightColor={`var(${ACCENT_VAR[card.accent]})`}
          className={styles.dualSpark}
        />
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
      </div>
    </div>
  );
};

export default PerfCompareCard;
