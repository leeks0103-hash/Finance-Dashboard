import { Button } from '@/components/ui';
import type { PerfPartRow } from '@/hooks/viewmodels/usePerformanceViewModel';
import styles from './PartAchievementBars.module.css';

interface Props {
  rows:    PerfPartRow[];
  visible: boolean;
  onToggle: () => void;
  month:   string;
}

const STRIP = /^[①-⑦⑧⑨⑩]\s*/;

const barColor = (rate: number) => {
  if (rate >= 100) return 'var(--profit)';
  if (rate >= 70)  return 'var(--warn)';
  return 'var(--loss)';
};

const PartAchievementBars = ({ rows, visible, onToggle, month }: Props) => {
  const sorted = [...rows].sort((a, b) => {
    const ra = a.planInitialNum > 0 ? a.junActualNum / a.planInitialNum : 0;
    const rb = b.planInitialNum > 0 ? b.junActualNum / b.planInitialNum : 0;
    return rb - ra;
  });

  return (
    <div className={styles.sectionGroup}>
      <div className={styles.header}>
        <span className={styles.title}>파트별 달성 현황 ({month} 기준)</span>
        <Button variant="ghost" size="sm" onClick={onToggle}>
          {visible ? '접기 ▲' : '펼치기 ▼'}
        </Button>
      </div>

      <div className={`${styles.wrap} ${visible ? styles.wrapOpen : ''}`}>
        <div className={styles.body}>
          {sorted.map(row => {
            const rate = row.planInitialNum > 0
              ? (row.junActualNum / row.planInitialNum) * 100
              : 0;
            const barW  = Math.min(rate, 100);
            const color = barColor(rate);
            const over  = rate >= 100;
            const partName = row.part.replace(STRIP, '');

            return (
              <div key={row.part} className={styles.row}>
                <span className={styles.partName}>{partName}</span>

                <div className={styles.barWrap}>
                  <div
                    className={styles.bar}
                    style={{ width: `${barW}%`, background: color }}
                  />
                  {over && <div className={styles.overMark} style={{ background: color }} />}
                </div>

                <span className={styles.pct} style={{ color }}>
                  {rate.toFixed(1)}%{over ? ' ✓' : ''}
                </span>

                <span className={styles.vals}>
                  {row.junActualNum.toFixed(1)}억 <span className={styles.slash}>/</span> {row.planInitialNum.toFixed(1)}억
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PartAchievementBars;
