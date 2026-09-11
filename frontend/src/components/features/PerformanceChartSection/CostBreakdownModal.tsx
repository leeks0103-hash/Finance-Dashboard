import { useState } from 'react';
import { DoughnutChart, Button } from '@/components/ui';
import BigCostDoughnut from './BigCostDoughnut';
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
  /** 왼쪽 큰 도넛의 조각 클릭 — 그 원가 항목의 프로젝트별 산출근거 표(PerfBreakdownModal)를 연다.
   *  현재 선택된 파트(없으면 전체) 기준으로 필터링해서 넘긴다. */
  onSliceClick: (seriesIndex: number, partOverride?: string) => void;
}

/**
 * 원가 비율 확대 모달 — 기존 레이아웃(왼쪽 큰 도넛 + 오른쪽 파트별 그리드) 그대로.
 * 오른쪽 그리드 카드를 클릭하면 그 파트 원가 비율이 왼쪽 큰 도넛에 표시된다 (기본: 전체).
 * 왼쪽 큰 도넛의 조각을 클릭하면 그 원가 항목의 프로젝트별 표가 별도 모달로 뜬다(상위에서 처리).
 * 카드 자체는 순수 선택 용도 — 표/드릴다운 기능을 넣지 않는다.
 */
const CostBreakdownModal = ({ total, byPart, partsRaw, colors, showLabels, onSliceClick }: Props) => {
  const [selected, setSelected] = useState<string>('');   // '' = 전체

  const active     = selected && byPart[selected] ? byPart[selected] : total;
  const activeName = selected ? stripPartPrefix(selected) : '전체';

  // '전체' 카드 + 파트 카드들 — 그리드 첫 칸에서 언제든 전체로 되돌아갈 수 있게
  const cells: { key: string; label: string; data: CostData }[] = [
    { key: '', label: '전체', data: total },
    ...partsRaw
      .filter(p => byPart[p])
      .map(p => ({ key: p, label: stripPartPrefix(p), data: byPart[p] })),
  ];

  return (
    <div className={styles.wrap}>
      {/* 왼쪽 — 선택한 파트(기본 전체)의 원가 비율을 크게. 조각 클릭 → 산출근거 표 모달 */}
      <div className={styles.left}>
        <span className={styles.sectionTitle}>{activeName}</span>
        <div className={styles.bigChart}>
          <BigCostDoughnut
            labels={active.labels}
            data={active.values}
            colors={colors}
            showLabels={showLabels}
            onSliceClick={i => onSliceClick(i, selected ? stripPartPrefix(selected) : undefined)}
          />
        </div>
      </div>

      {/* 오른쪽 — 파트별 원가 비율 그리드 (카드 클릭 → 왼쪽에 크게. 카드 자체엔 클릭-드릴다운 없음) */}
      <div className={styles.right}>
        <span className={styles.sectionTitle}>파트별</span>
        <div className={styles.partGrid}>
          {cells.map(({ key, label, data }) => {
            const on = selected === key;
            return (
              <Button
                key={key || '__all__'}
                unstyled
                className={`${styles.partCard} ${on ? styles.partCardActive : ''}`}
                onClick={() => setSelected(key)}
                aria-pressed={on}
              >
                <span className={styles.partLabel}>{label}</span>
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
