import type { ReactNode } from 'react';
import type { PerfPartRow } from '@/hooks/viewmodels/usePerformanceViewModel';
import { InfoButton, Button } from '@/components/ui';
import { stripPartPrefix } from '@/utils';
import { sortByPart } from '@/utils/partOrder';
import styles from './PartAchievementBars.module.css';

interface Props {
  rows:  PerfPartRow[];
  month: string;
  info?: ReactNode;
  /** 파트 행 클릭 — 드릴다운 모달 열기. 전달 값은 접두 원문자 제거된 파트명 */
  onPartClick?: (part: string) => void;
}

// 달성률 구간별 색 — 막대와 범례가 같은 정의를 쓰도록 한 곳에서 관리.
// 범례에 낮은 구간부터 순서대로 나오도록 오름차순으로 정의 (barColor는 순서 무관하게 동작)
const RATE_BANDS = [
  { min: -Infinity, color: 'var(--loss)',          label: '30% 미만' },   // Active Red
  { min: 30,         color: 'var(--warn)',         label: '30~60%' },    // Hyundai Gold(갈색)
  { min: 60,         color: 'rgba(0,170,210,0.9)', label: '60~100%' },   // Active Blue — 전체 평균 원가비율 도넛의 인건비와 동일
  { min: 100,        color: 'var(--profit)',       label: '100% 이상' },
];

const barColor = (rate: number) => {
  const matched = RATE_BANDS.filter(b => rate >= b.min);
  const top = matched.reduce((a, b) => (b.min > a.min ? b : a), matched[0] ?? RATE_BANDS[0]);
  return top.color;
};

const PartAchievementBars = ({ rows, month, info, onPartClick }: Props) => {
  const sorted = sortByPart(rows, r => r.part);   // 담당자 지정 고정 순서


  return (
    <div className={styles.sectionGroup}>
      <div className={styles.header}>
        <span className={styles.title}>파트별 매출 진행 현황 ({month}기준)</span>
        {info && <InfoButton>{info}</InfoButton>}
        <span className={styles.legend}>
          {RATE_BANDS.map(b => (
            <span key={b.label} className={styles.legendItem}>
              <i className={styles.legendDot} style={{ background: b.color }} />
              {b.label}
            </span>
          ))}
        </span>
      </div>

      <div className={`${styles.wrap} ${styles.wrapOpen}`}>
        <div className={styles.body}>
          {/* 기준 구간 수치(30/60/100%) — 행마다 반복하지 않고 맨 위에 한 번만, 막대 트랙 칸에 맞춰 정렬 */}
          <div className={styles.row} aria-hidden>
            <span />
            <div className={styles.thresholdHeaderTrack}>
              {[30, 60, 100].map(t => (
                <span key={t} className={styles.thresholdHeaderLabel} style={{ left: `${t}%` }}>{t}%</span>
              ))}
            </div>
            <span />
            <span />
          </div>

          {sorted.map(row => {
            const rate  = row.achieveRateNum;
            const barW  = Math.min(rate, 100);
            const color = barColor(rate);
            const partName = stripPartPrefix(row.part);

            const inner = (
              <>
                <span className={styles.partName}>{partName}</span>

                <div className={styles.barWrap}>
                  {/* 기준 구간 경계선(30/60/100%) — 수치는 맨 위 헤더에 한 번만 표시 */}
                  {[30, 60, 100].map(t => (
                    <div key={t} className={styles.thresholdMark} style={{ left: `${t}%` }} />
                  ))}
                  <div
                    className={styles.bar}
                    style={{ width: `${barW}%`, background: color }}
                  />
                </div>

                <span className={styles.pct}>
                  {rate.toFixed(1)}%
                </span>

                <span className={styles.vals}>
                  {row.junActualNum.toFixed(1)}억 <span className={styles.slash}>/</span> {row.planInitialNum.toFixed(1)}억
                </span>
              </>
            );

            return onPartClick ? (
              <Button
                key={row.part}
                unstyled
                className={`${styles.row} ${styles.rowClickable}`}
                onClick={() => onPartClick(partName)}
                title={`${partName} — 프로젝트별 상세`}
              >
                {inner}
              </Button>
            ) : (
              <div key={row.part} className={styles.row}>{inner}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PartAchievementBars;
