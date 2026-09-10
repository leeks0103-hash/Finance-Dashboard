import { DoughnutChart } from '@/components/ui';
import { stripPartPrefix } from '@/utils';
import styles from './CostBreakdownModal.module.css';

interface CostData {
  labels: string[];
  values: number[];
}

interface Props {
  total:      CostData;
  byPart:     Record<string, CostData>;
  partsRaw:   string[];
  colors:     string[];
  showLabels: boolean;
}

const CostBreakdownModal = ({ total, byPart, partsRaw, colors, showLabels }: Props) => (
  <div className={styles.wrap}>
    {/* 왼쪽 — 전체 평균 원가 비율 */}
    <div className={styles.left}>
      <span className={styles.sectionTitle}>전체</span>
      <div className={styles.bigChart}>
        <DoughnutChart
          labels={total.labels}
          data={total.values}
          colors={colors}
          showLabels={showLabels}
        />
      </div>
    </div>

    {/* 오른쪽 — 파트별 원가 비율 그리드 */}
    <div className={styles.right}>
      <span className={styles.sectionTitle}>파트별</span>
      <div className={styles.partGrid}>
        {partsRaw.map(part => {
          const data = byPart[part];
          if (!data) return null;
          return (
            <div key={part} className={styles.partCard}>
              <span className={styles.partLabel}>{stripPartPrefix(part)}</span>
              <div className={styles.smallChart}>
                <DoughnutChart
                  labels={data.labels}
                  data={data.values}
                  colors={colors}
                  showLabels={false}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

export default CostBreakdownModal;
