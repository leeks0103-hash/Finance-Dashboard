import { useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import BigCostDoughnut from './BigCostDoughnut';
import { stripPartPrefix } from '@/utils';
import styles from './CostBreakdownModal.module.css';

interface CostData {
  labels: string[];
  values: number[];
}

interface Props {
  total:              CostData;
  byPart:             Record<string, CostData>;
  partsRaw:           string[];
  teams:              string[];
  teamParts:          Record<string, string[]>;
  /** 파트별 손익률(%) — 오른쪽 미니카드 "손익률" 항목용 */
  profitRateByPart:   Record<string, number>;
  /** 전사 평균 손익률(%) — 미니카드 비교 기준선 */
  avgProfitRateTotal: number;
  colors:             string[];
  showLabels:         boolean;
  /** 왼쪽 큰 도넛의 조각 클릭 — 그 원가 항목의 프로젝트별 산출근거 표(PerfBreakdownModal)를 연다.
   *  현재 선택된 파트(없으면 전체) 기준으로 필터링해서 넘긴다. */
  onSliceClick: (seriesIndex: number, partOverride?: string) => void;
}

const COST_LABELS = ['직접원가', '인건비', '공통원가', '관리비', '경상손익'];
const TEAM_ITEM_IDX = [0, 1, 4];        // 팀 모드 — 직접원가·인건비·경상손익 3개
const PART_ITEM_IDX = [0, 1, 2, 3, 4];  // 파트 모드 — 5개 + 손익률(별도)

interface MiniItem { label: string; value: number; unit: '억' | '%'; color: string; baseline: number }

/**
 * 원가 비율 확대 모달 — 왼쪽 큰 도넛(선택한 파트 또는 전사평균) + 오른쪽(팀/파트 탭 + 비교 미니카드).
 * 오른쪽은 왼쪽과 비교하기 위한 용도 — 팀 탭을 고르면 그 팀 소속 파트 합계로 3개 항목,
 * 파트 탭을 고르면 그 파트 6개 항목(+손익률)을 미니카드로 보여준다. 각 카드의 ▲/▼는
 * 전사 평균 대비 위/아래를 나타낸다. 파트 탭은 왼쪽 큰 도넛도 같이 바꾼다.
 */
const CostBreakdownModal = ({
  total, byPart, partsRaw, teams, teamParts, profitRateByPart, avgProfitRateTotal,
  colors, showLabels, onSliceClick,
}: Props) => {
  const [selected, setSelected]     = useState<string>('');            // '' = 전체 — 왼쪽 도넛 + 파트 모드 카드
  const [activeTeam, setActiveTeam] = useState<string>('');            // '' = 전체 — 팀 모드 카드
  const [rightMode, setRightMode]   = useState<'team' | 'part'>('part');

  const active     = selected && byPart[selected] ? byPart[selected] : total;
  const activeName = selected ? stripPartPrefix(selected) : '전사평균';

  // 팀 소속 파트 원가 항목 합계 (팀 모드 미니카드용)
  const teamAggregate: CostData = useMemo(() => {
    if (!activeTeam) return total;
    const allowed = new Set(teamParts[activeTeam] ?? []);
    const sums = [0, 0, 0, 0, 0];
    partsRaw.forEach(p => {
      if (!allowed.has(p)) return;
      byPart[p]?.values.forEach((v, i) => { sums[i] += v; });
    });
    return { labels: COST_LABELS, values: sums };
  }, [activeTeam, partsRaw, teamParts, byPart, total]);

  const miniItems: MiniItem[] = useMemo(() => {
    if (rightMode === 'team') {
      return TEAM_ITEM_IDX.map(i => ({
        label: COST_LABELS[i], unit: '억' as const, color: colors[i],
        value: teamAggregate.values[i] ?? 0,
        baseline: total.values[i] ?? 0,
      }));
    }
    const partData = selected && byPart[selected] ? byPart[selected] : total;
    const rate = selected ? (profitRateByPart[selected] ?? avgProfitRateTotal) : avgProfitRateTotal;
    return [
      ...PART_ITEM_IDX.map(i => ({
        label: COST_LABELS[i], unit: '억' as const, color: colors[i],
        value: partData.values[i] ?? 0,
        baseline: total.values[i] ?? 0,
      })),
      { label: '손익률', unit: '%' as const, color: colors[4], value: rate, baseline: avgProfitRateTotal },
    ];
  }, [rightMode, teamAggregate, total, selected, byPart, profitRateByPart, avgProfitRateTotal, colors]);

  return (
    <div className={styles.wrap}>
      {/* 왼쪽 — 선택한 파트(기본 전사평균)의 원가 비율을 크게. 조각 클릭 → 산출근거 표 모달 */}
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

      {/* 오른쪽 — 팀/파트 탭 + 비교용 미니카드(전사 평균 대비 ▲/▼) */}
      <div className={styles.right}>
        <span className={styles.sectionTitle}>팀</span>
        <div className={styles.teamTabs}>
          <Button
            unstyled
            className={`${styles.teamTab} ${rightMode === 'team' && !activeTeam ? styles.teamTabActive : ''}`}
            onClick={() => { setRightMode('team'); setActiveTeam(''); }}
          >
            전체
          </Button>
          {teams.map(t => (
            <Button
              key={t}
              unstyled
              className={`${styles.teamTab} ${rightMode === 'team' && activeTeam === t ? styles.teamTabActive : ''}`}
              onClick={() => { setRightMode('team'); setActiveTeam(t); }}
            >
              {t}
            </Button>
          ))}
        </div>

        <span className={styles.sectionTitle}>파트</span>
        <div className={styles.teamTabs}>
          <Button
            unstyled
            className={`${styles.teamTab} ${rightMode === 'part' && !selected ? styles.teamTabActive : ''}`}
            onClick={() => { setRightMode('part'); setSelected(''); }}
          >
            전체
          </Button>
          {partsRaw.map(p => (
            <Button
              key={p}
              unstyled
              className={`${styles.teamTab} ${rightMode === 'part' && selected === p ? styles.teamTabActive : ''}`}
              onClick={() => { setRightMode('part'); setSelected(p); }}
            >
              {stripPartPrefix(p)}
            </Button>
          ))}
        </div>

        <div className={styles.miniGrid}>
          {miniItems.map(item => {
            const up = item.value >= item.baseline;
            return (
              <div key={item.label} className={styles.miniCard}>
                <span className={styles.miniRing} style={{ borderColor: item.color }} />
                <span className={styles.miniLabel}>{item.label}</span>
                <span className={`${styles.miniValue} ${up ? styles.up : styles.down}`}>
                  {up ? '▲' : '▼'} {item.value.toFixed(1)}{item.unit}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CostBreakdownModal;
