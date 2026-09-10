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

// 달성률 구간별 색 — 막대와 범례가 같은 정의를 쓰도록 한 곳에서 관리
const RATE_BANDS = [
  { min: 100, color: 'var(--profit)', label: '100% 이상' },
  { min: 70,  color: 'var(--sky-blue)', label: '70~100%' },
  { min: -Infinity, color: 'var(--warn)', label: '70% 미만' },   // Hyundai Gold (PMS 876C)
];

const barColor = (rate: number) =>
  (RATE_BANDS.find(b => rate >= b.min) ?? RATE_BANDS[RATE_BANDS.length - 1]).color;

const PartAchievementBars = ({ rows, month, info, onPartClick }: Props) => {
  const sorted = sortByPart(rows, r => r.part);   // 담당자 지정 고정 순서

  // 경과 기준선 — 분자는 N개월 누계인데 분모는 연간 계획이라, 이 시점이면 여기까지 와야 '정상 페이스'.
  // 막대가 이 선을 넘으면 계획보다 앞선 것. (달성률 자체를 안분으로 바꾸는 대신 기준선으로 오독 방지)
  const paceMonth = parseInt(month, 10) || 0;
  const pacePct   = paceMonth > 0 ? (paceMonth / 12) * 100 : 0;

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
          {pacePct > 0 && (
            <span className={styles.legendItem}>
              <i className={styles.paceDot} />
              {paceMonth}개월 경과 기준선 ({pacePct.toFixed(0)}%)
            </span>
          )}
        </span>
      </div>

      <div className={`${styles.wrap} ${styles.wrapOpen}`}>
        <div className={styles.body}>
          {sorted.map(row => {
            const rate  = row.achieveRateNum;
            const barW  = Math.min(rate, 100);
            const color = barColor(rate);
            const over  = rate >= 100;
            const partName = stripPartPrefix(row.part);

            const inner = (
              <>
                <span className={styles.partName}>{partName}</span>

                <div className={styles.barWrap}>
                  <div
                    className={styles.bar}
                    style={{ width: `${barW}%`, background: color }}
                  />
                  {pacePct > 0 && (
                    <div
                      className={styles.paceMark}
                      style={{ left: `${pacePct}%` }}
                      title={`${paceMonth}개월 경과 기준선 — 이 시점이면 여기까지가 정상 페이스`}
                    />
                  )}
                  {over && <div className={styles.overMark} style={{ background: color }} />}
                </div>

                <span className={styles.pct}>
                  {rate.toFixed(1)}%{over ? ' ✓' : ''}
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
