import { useState } from 'react';
import { DoughnutChart, Button } from '@/components/ui';
import { usePerfStore } from '@/store/perf.store';
import { usePerfCostBreakdownDetail } from '@/hooks/usePerfCostBreakdownDetail';
import { stripPartPrefix } from '@/utils';
import styles from './CostBreakdownModal.module.css';

interface CostData {
  labels: string[];
  values: number[];
}

interface Props {
  total:    CostData;
  byPart:   Record<string, CostData>;
  partsRaw: string[];
  colors:   string[];
}

const COST_COLS = [
  { key: 'cost_direct',      label: '직접원가' },
  { key: 'cost_labor',       label: '인건비' },
  { key: 'cost_overhead',    label: '공통원가' },
  { key: 'cost_mgmt',        label: '관리비' },
  { key: 'operating_profit', label: '경상손익' },
] as const;

/**
 * 원가 비율 확대 모달 — 기존 레이아웃(왼쪽 큰 영역 + 오른쪽 파트별 그리드) 그대로.
 * 왼쪽은 도넛 대신 "프로젝트별 원가 구성" 표 — 오른쪽 그리드 카드를 클릭하면 그 파트 기준으로 바뀐다.
 * 그리드 첫 칸은 '전체' 카드. 카드 자체엔 표 기능을 넣지 않고 순수 선택 용도로만 둔다.
 */
const CostBreakdownModal = ({ total, byPart, partsRaw, colors }: Props) => {
  const [selected, setSelected] = useState<string>('');   // '' = 전체, 그 외 = partsRaw의 원문(접두어 포함)

  const pageParts = usePerfStore(s => s.selectedParts);   // 페이지 필터(이미 접두어 제거된 값)
  const pageTeam  = usePerfStore(s => s.selectedTeam);
  const detailParts = selected ? [stripPartPrefix(selected)] : pageParts;
  const detail = usePerfCostBreakdownDetail(detailParts, pageTeam);

  const activeName = selected ? stripPartPrefix(selected) : '전체';

  // '전체' 카드 + 파트 카드들 — 그리드 첫 칸에서 언제든 전체로 되돌아갈 수 있게
  const cells: { key: string; label: string; data: CostData }[] = [
    { key: '', label: '전체', data: total },
    ...partsRaw
      .filter(p => byPart[p])
      .map(p => ({ key: p, label: stripPartPrefix(p), data: byPart[p] })),
  ];

  const body = (() => {
    if (detail.isLoading) return <div className={styles.state}>불러오는 중…</div>;
    if (detail.isError)   return <div className={styles.state}>데이터를 불러오지 못했습니다.</div>;
    const rows = detail.data?.rows ?? [];
    if (!rows.length) return <div className={styles.state}>표시할 프로젝트가 없습니다.</div>;

    const t = detail.data?.total ?? {};
    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.codeCol}>프로젝트</th>
              <th>파트</th>
              {COST_COLS.map(c => <th key={c.key} className={styles.num}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.project_code || r.project_name}>
                <td className={styles.codeCol}>
                  {r.project_code || '—'}
                  {r.project_name && <span className={styles.pname}> · {r.project_name}</span>}
                </td>
                <td>{stripPartPrefix(r.part) || '—'}</td>
                {COST_COLS.map(c => (
                  <td key={c.key} className={styles.num}>{r[c.key].toLocaleString()}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>합계 (억, {detail.data?.count ?? rows.length}건)</td>
              {COST_COLS.map(c => (
                <td key={c.key} className={styles.num}>{(t[c.key] ?? 0).toLocaleString()}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    );
  })();

  return (
    <div className={styles.wrap}>
      {/* 왼쪽 — 선택한 파트(기본 전체)의 프로젝트별 원가 구성 표 */}
      <div className={styles.left}>
        <span className={styles.sectionTitle}>{activeName} · 프로젝트별 원가 구성 (억)</span>
        <div className={styles.bigChart}>{body}</div>
      </div>

      {/* 오른쪽 — 파트별 원가 비율 그리드 (카드 클릭 → 왼쪽 표에 반영, 카드 자체엔 표 기능 없음) */}
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
