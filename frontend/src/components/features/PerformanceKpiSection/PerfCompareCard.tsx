import type { CSSProperties } from 'react';
import type { PerfCompareCardData } from '@/hooks/viewmodels/usePerformanceViewModel';
import { useChartPalette } from '@/hooks/useChartPalette';
import { LineIcon } from '@/components/ui/LineIcon';
import { useCompareCardViewModel } from '@/hooks/viewmodels/useCompareCardViewModel';
import { splitValueUnit } from '@/utils/format';
import styles from './PerfCompareCard.module.css';

/** "137.0억원" → 숫자 칸(오른쪽 정렬 고정폭) + 단위로 분리 렌더링 — 계획/추정 자릿수가 달라도
    "억원" 단위가 항상 같은 자리에 오도록 (0.0억원 / 88.2억원처럼 자릿수 차가 클 때 특히 필요) */
const ValueUnit = ({ value, className, title }: { value: string; className: string; title?: string }) => {
  const { num, unit } = splitValueUnit(value);
  return (
    <span className={className} title={title}>
      <span className={styles.numPart}>{num}</span>
      {unit && <span className={styles.unitPart}>{unit}</span>}
    </span>
  );
};

/** 계획 → 추정(연간) 두 값 비교 카드 — 매출·원가·매출이익. 미니 2막대 그래프 포함 */
const PerfCompareCard = ({ card }: { card: PerfCompareCardData }) => {
  // 상단 바 색 = 차트 색상 역할(2026-10-27) — 설정에서 바꾼 차트 색·주간/야간이 같이 반영됨. 역할이 없으면 accent 색(CSS)
  const palette = useChartPalette();
  const { planText, estText } = useCompareCardViewModel(card);   // 값이 바뀔 때 숫자가 이어서 움직임(2026-10-28)
  const barColor = card.colorRole ? palette[card.colorRole] : undefined;
  // 미니 2막대(.bars) 주석 처리(2026-10-27 요청) — 복구하려면 아래 JSX 주석과 이 변수들을 같이 해제
  // // 막대 높이 = 실제 비율 그대로. 큰 값 100%, 작은 값은 (작은값/큰값)*100%
  // const planAbs = Math.abs(card.planNum);
  // const estAbs  = Math.abs(card.estNum);
  // const hi = Math.max(planAbs, estAbs, 1);
  // const planH = `${Math.round((planAbs / hi) * 100)}%`;
  // const estH  = `${Math.round((estAbs  / hi) * 100)}%`;

  // 제목 끝의 "(계획/추정)"(2027 계획 보기는 "(26 추정/27 계획)")을 떼어 둘째 줄에 따로 그림 — 없는 제목은 그대로 한 덩어리
  const m = card.label.match(/^(.*?)\s*(\((?:계획\/추정|26 추정\/27 계획)\))$/);
  const labelMain   = m ? m[1] : card.label;
  const labelSuffix = m ? m[2] : '';

  return (
    <div
      className={`${styles.card} ${styles[card.accent]}${barColor ? ` ${styles.hasBar}` : ''}`}
      style={barColor ? ({ '--bar-color': barColor } as CSSProperties) : undefined}
    >
      <div className={styles.header}>
        <span className={`${styles.label} ${card.labelNote ? styles.labelNoted : ''}`}>
          {/* 제목 + "(계획/추정)"을 한 줄에 나란히(2026-11-05 요청 — 예전엔 "(계획/추정)"이 항상 둘째 줄이었음, 10-27). 둘째 줄은 labelNote 자리
              (매출이익 카드의 계산식). 앞부분 끝 공백은 글자 모양엔 영향 없고 textContent("… (계획/추정)")만 예전 그대로 유지 */}
          <span className={styles.titleLine}>
            <span className={styles.labelMain} title={card.label}>{labelMain}{labelSuffix ? ' ' : ''}</span>
            {labelSuffix && <span className={styles.labelSuffix}>{labelSuffix}</span>}
          </span>
          {/* 둘째 줄 안내(매출이익 계산식) — 앞에 수식(∴) 아이콘(2026-11-05 요청: 수식임을 암시, Σ에서 교체) */}
          {card.labelNote && (
            <span className={styles.labelNote}>
              <LineIcon kind="formula" size={12} className={styles.noteIcon} />
              {card.labelNote}
            </span>
          )}
        </span>
        {/* 계획 값이 없으면(diffStr '') 차이 알약도 안 그림 */}
        {card.diffStr && (
          <span key={card.diffStr} className={`${styles.diff} ${card.diffUp ? styles.up : styles.down}`} title={card.diffTitle}>
            {card.diffUp ? '▲' : '▼'} {card.diffStr}
          </span>
        )}
      </div>

      <div className={styles.body}>
        <div className={`${styles.valuesWrap}${card.sub ? ` ${styles.hasSub}` : ''}`}>
          {/* 추정 값 위 "계획 대비 추정" 비율(2026-10-27) — 값이 없어도 줄은 남겨 카드마다 값 높이를 맞춤 */}
          <div className={styles.rateRow}>
            {card.rateStr && (
              <span key={card.rateStr} className={styles.rate}
                title={card.rateLabel ? `${card.rateLabel} 비율` : '계획 대비 추정 비율 (추정 ÷ 계획)'}>
                {card.rateLabel ?? '계획 대비'} {card.rateStr}
              </span>
            )}
          </div>
          <div className={styles.values}>
            <div className={styles.planRow}>
              {/* 마우스오버 = 억으로 줄이기 전 정확한 원 단위 값(2026-11-02 요청) */}
              <ValueUnit value={planText} className={styles.plan} title={card.planTitle} />
              <span className={styles.slash}>/</span>
            </div>
            <ValueUnit value={estText} className={styles.est} title={card.estTitle} />
          </div>
          {/* 값 바로 아래 보조 줄(관리비 "매출 대비 N%" 등) — 값 위치는 다른 카드와 같게 두려고 아래로 매닮 */}
          {card.sub && (
            <div className={styles.subs}>
              <div key={card.sub} className={`${styles.sub}${card.subRight ? ` ${styles.subRight}` : ''}`}>{card.sub}</div>
            </div>
          )}
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
    </div>
  );
};

export default PerfCompareCard;
