import type { CSSProperties } from 'react';
import type { PerfCompareCardData } from '@/hooks/viewmodels/usePerformanceViewModel';
// import { Sparkline } from '@/components/ui/Sparkline';   // 스파크라인 주석 처리(2026-10-27 "곡선 이미지 삭제")
import { useChartPalette } from '@/hooks/useChartPalette';
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
  // 상단 바 색 = 차트 색상 역할(2026-10-27) — 설정에서 바꾼 차트 색·주간/야간이 같이 반영됨. 역할이 없으면 accent 색(CSS)
  const palette = useChartPalette();
  const barColor = card.colorRole ? palette[card.colorRole] : undefined;
  // 미니 2막대(.bars) 주석 처리(2026-10-27 요청) — 복구하려면 아래 JSX 주석과 이 변수들을 같이 해제
  // // 막대 높이 = 실제 비율 그대로. 큰 값 100%, 작은 값은 (작은값/큰값)*100%
  // const planAbs = Math.abs(card.planNum);
  // const estAbs  = Math.abs(card.estNum);
  // const hi = Math.max(planAbs, estAbs, 1);
  // const planH = `${Math.round((planAbs / hi) * 100)}%`;
  // const estH  = `${Math.round((estAbs  / hi) * 100)}%`;

  // 제목 끝의 "(계획/추정)"을 떼어 둘째 줄에 따로 그림 — 없는 제목은 그대로 한 덩어리
  const m = card.label.match(/^(.*?)\s*(\(계획\/추정\))$/);
  const labelMain   = m ? m[1] : card.label;
  const labelSuffix = m ? m[2] : '';

  return (
    <div
      className={`${styles.card} ${styles[card.accent]}${barColor ? ` ${styles.hasBar}` : ''}`}
      style={barColor ? ({ '--bar-color': barColor } as CSSProperties) : undefined}
    >
      <div className={styles.header}>
        <span className={`${styles.label} ${card.labelNote ? styles.labelNoted : ''}`}>
          {/* "(계획/추정)"은 모든 카드에서 항상 둘째 줄(2026-10-27 요청) — 제목 앞부분과 따로 줄을 나눠 그림.
              앞부분 끝 공백은 글자 모양엔 영향 없고 textContent("… (계획/추정)")만 예전 그대로 유지 */}
          <span className={styles.labelMain} title={card.label}>{labelMain}{labelSuffix ? ' ' : ''}</span>
          {labelSuffix && <span className={styles.labelSuffix}>{labelSuffix}</span>}
          {card.labelNote && <span className={styles.labelNote}>{card.labelNote}</span>}
        </span>
        {/* 계획 값이 없으면(diffStr '') 차이 알약도 안 그림 */}
        {card.diffStr && (
          <span className={`${styles.diff} ${card.diffUp ? styles.up : styles.down}`}>
            {card.diffUp ? '▲' : '▼'} {card.diffStr}
          </span>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.valuesWrap}>
          {/* 추정 값 위 "계획 대비 추정" 비율(2026-10-27) — 값이 없어도 줄은 남겨 카드마다 값 높이를 맞춤 */}
          <div className={styles.rateRow}>
            {card.rateStr && <span className={styles.rate} title="계획 대비 추정 비율 (추정 ÷ 계획)">계획 대비 {card.rateStr}</span>}
          </div>
          <div className={styles.values}>
            <div className={styles.planRow}>
              <ValueUnit value={card.planStr} className={styles.plan} />
              <span className={styles.slash}>/</span>
            </div>
            <ValueUnit value={card.estStr} className={styles.est} />
          </div>
          {/* 값 바로 아래 보조 줄(관리비 "매출 대비 N%" 등) — 값 위치는 다른 카드와 같게 두려고 아래로 매닮 */}
          {card.sub && <div className={styles.sub}>{card.sub}</div>}
        </div>

        {/* 미니 2막대(계획/추정) 주석 처리(2026-10-27 요청) — 복구하려면 이 주석을 풀고 위 변수도 해제
        <div className={styles.bars} aria-hidden>
          <div className={styles.barCol}>
            {/ * barTrack — 캡션을 뺀 "막대만의 영역". 이게 없으면 막대(height %)와 캡션이
                같은 flex 칸을 나눠 갖다가 100% 막대만 flex-shrink로 찌그러져서
                높이 차이가 사라짐 * /}
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
        */}
      </div>

      {/* 오른쪽 구석 하단 스파크라인 주석 처리(2026-10-27 요청 "카드들 그래프 곡선 이미지 삭제") — 복구하려면 아래 주석과 위 import를 풀 것.
          (CSS .sparkWrap/.sparkUp/.sparkDown은 그대로 남겨 둠)
      {card.diffStr && (
        <div className={`${styles.sparkWrap} ${card.diffUp ? styles.sparkUp : styles.sparkDown}`} aria-hidden>
          <Sparkline up={card.diffUp} className={styles.spark} />
        </div>
      )}
      */}
    </div>
  );
};

export default PerfCompareCard;
