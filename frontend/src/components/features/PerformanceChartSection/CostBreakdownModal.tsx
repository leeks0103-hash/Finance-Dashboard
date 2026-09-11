import { useState } from 'react';
import { DoughnutChart, Button } from '@/components/ui';
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

/**
 * 원가 비율 확대 모달 — 기존 레이아웃(왼쪽 큰 도넛 + 오른쪽 파트별 그리드) 그대로.
 * 추가된 것: 오른쪽 그리드의 파트 카드를 클릭하면 그 파트의 원가 비율이 왼쪽 큰 도넛에 표시된다.
 * (같은 카드를 다시 클릭하거나 아무것도 안 고르면 전체)
 */
const CostBreakdownModal = ({ total, byPart, partsRaw, colors, showLabels }: Props) => {
  const [selected, setSelected] = useState<string>('');   // '' = 전체

  const active     = selected && byPart[selected] ? byPart[selected] : total;
  const activeName = selected ? stripPartPrefix(selected) : '전체';

  return (
    <div className={styles.wrap}>
      {/* 왼쪽 — 선택한 파트(기본 전체)의 원가 비율 */}
      <div className={styles.left}>
        <span className={styles.sectionTitle}>{activeName}</span>
        <div className={styles.bigChart}>
          <DoughnutChart
            labels={active.labels}
            data={active.values}
            colors={colors}
            showLabels={showLabels}
          />
        </div>
      </div>

      {/* 오른쪽 — 파트별 원가 비율 그리드 (카드 클릭 → 왼쪽에 크게) */}
      <div className={styles.right}>
        <span className={styles.sectionTitle}>파트별 · 카드 클릭 시 왼쪽에 크게</span>
        <div className={styles.partGrid}>
          {partsRaw.map(part => {
            const data = byPart[part];
            if (!data) return null;
            const on = selected === part;
            return (
              <Button
                key={part}
                unstyled
                className={`${styles.partCard} ${on ? styles.partCardActive : ''}`}
                onClick={() => setSelected(on ? '' : part)}
                aria-pressed={on}
              >
                <span className={styles.partLabel}>{stripPartPrefix(part)}</span>
                <div className={styles.smallChart}>
                  <DoughnutChart
                    labels={data.labels}
                    data={data.values}
                    colors={colors}
                    showLabels={false}
                  />
                </div>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CostBreakdownModal;
