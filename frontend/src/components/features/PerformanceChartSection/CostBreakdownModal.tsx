import { useState } from 'react';
import { Button, DoughnutChart } from '@/components/ui';
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
  teams:      string[];
  teamParts:  Record<string, string[]>;
  colors:     string[];
  showLabels: boolean;
  /** 왼쪽 큰 도넛(항상 전사평균)의 조각 클릭 — 그 원가 항목의 프로젝트별 산출근거 표를 연다 */
  onSliceClick: (seriesIndex: number) => void;
}

const COST_LABELS = ['직접원가', '인건비', '공통원가', '관리비', '경상손익'];

/**
 * 원가 비율 확대 모달 — 왼쪽은 항상 전사평균 고정, 오른쪽은 팀/파트 보기 전환 + 비교용 미니 도넛.
 * "팀" 선택 시 팀별로(소속 파트 합계), "파트" 선택 시 파트별로 미니 도넛이 나열되고,
 * 각 카드 밑에 경상손익을 전사 평균과 비교하는 ▲/▼ 수치를 표시한다.
 * 카드의 "상세보기"를 누르면 5개 원가 항목(직접원가·인건비·공통원가·관리비·경상손익)
 * 전부를 전사평균과 나란히 비교하는 목록이 펼쳐진다.
 */
const CostBreakdownModal = ({ total, byPart, partsRaw, teams, teamParts, colors, showLabels, onSliceClick }: Props) => {
  const [rightMode, setRightMode] = useState<'team' | 'part'>('part');
  // 카드별 "상세보기" 펼침 상태 — 여러 카드 동시에 펼쳐서 비교 가능
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const teamData = (team: string): CostData => {
    const allowed = new Set(teamParts[team] ?? []);
    const sums = [0, 0, 0, 0, 0];
    partsRaw.forEach(p => {
      if (allowed.has(p)) byPart[p]?.values.forEach((v, i) => { sums[i] += v; });
    });
    return { labels: COST_LABELS, values: sums };
  };

  const cells = rightMode === 'team'
    ? teams.map(t => ({ key: t, label: t, data: teamData(t) }))
    : partsRaw.filter(p => byPart[p]).map(p => ({ key: p, label: stripPartPrefix(p), data: byPart[p] }));

  const totalProfit = total.values[4] ?? 0;

  return (
    <div className={styles.wrap}>
      {/* 왼쪽 — 항상 전사평균 고정. 조각 클릭 → 산출근거 표 모달 */}
      <div className={styles.left}>
        <span className={styles.sectionTitle}>전사평균</span>
        <div className={styles.bigChart}>
          <BigCostDoughnut
            labels={total.labels}
            data={total.values}
            colors={colors}
            showLabels={showLabels}
            onSliceClick={onSliceClick}
          />
        </div>
      </div>

      {/* 오른쪽 — 팀/파트 보기 전환 + 비교용 미니 도넛(전사 평균 경상손익 대비 ▲/▼) */}
      <div className={styles.right}>
        <div className={styles.modeTabs}>
          <Button
            unstyled
            className={`${styles.modeTab} ${rightMode === 'team' ? styles.modeTabActive : ''}`}
            onClick={() => setRightMode('team')}
          >
            팀
          </Button>
          <Button
            unstyled
            className={`${styles.modeTab} ${rightMode === 'part' ? styles.modeTabActive : ''}`}
            onClick={() => setRightMode('part')}
          >
            파트
          </Button>
        </div>

        <div className={styles.partGrid}>
          {cells.map(({ key, label, data }) => {
            const profit = data.values[4] ?? 0;
            const up = profit >= totalProfit;
            const isOpen = expanded.has(key);
            return (
              <div key={key} className={styles.partCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.partLabel}>{label}</span>
                  <span className={`${styles.miniValue} ${up ? styles.up : styles.down}`}>
                    ({up ? '▲' : '▼'} {profit.toFixed(1)}억)
                  </span>
                </div>
                <div className={styles.smallChart}>
                  <DoughnutChart
                    labels={data.labels}
                    data={data.values}
                    colors={colors}
                    showLabels={showLabels}
                    outsideLabels
                    outsideLabelsSize="sm"
                  />
                </div>

                <Button
                  unstyled
                  className={styles.detailToggle}
                  onClick={() => toggleExpanded(key)}
                  aria-expanded={isOpen}
                >
                  {isOpen ? '접기 ▴' : '상세보기 ▾'}
                </Button>

                {isOpen && (
                  <ul className={styles.detailPanel}>
                    {COST_LABELS.map((costLabel, i) => {
                      const totalVal = total.values[i] ?? 0;
                      const cardVal  = data.values[i] ?? 0;
                      const diff = cardVal - totalVal;
                      const diffUp = diff >= 0;
                      return (
                        <li key={costLabel} className={styles.detailRow}>
                          <span className={styles.detailLabel}>{costLabel}</span>
                          <span className={styles.detailVal}>
                            <span className={styles.detailValMuted}>전사 {totalVal.toFixed(1)}</span>
                            <span className={styles.detailValSelf}>{label} {cardVal.toFixed(1)}</span>
                          </span>
                          <span className={`${styles.detailDiff} ${diffUp ? styles.up : styles.down}`}>
                            {diffUp ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}억
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CostBreakdownModal;
