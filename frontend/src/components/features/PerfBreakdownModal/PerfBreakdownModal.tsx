import { Button, CopyText, Modal, ModalBadge } from '@/components/ui';
import {
  usePerfBreakdownViewModel,
  fmtPerfBreakdown,
  type PerfBreakdownTarget,
} from '@/hooks/viewmodels/usePerfBreakdownViewModel';
import { downloadCsvFile } from '@/hooks/useExport';
import { stripPartPrefix } from '@/utils/format';
import type { PerfBreakdownRow, PerfBreakdownCompareRow } from '@/api/performance.api';
import BreakdownTable, { type BreakdownColumn } from '@/components/features/BreakdownModal/BreakdownTable';
import styles from './PerfBreakdownModal.module.css';

interface Props {
  target:  PerfBreakdownTarget;
  onClose: () => void;
}

/**
 * 실적현황 차트 막대를 클릭하면 열리는 드릴다운 모달 (KPI와 동일 패턴).
 * "이 막대 값 = 어떤 프로젝트 행들을 합산한 결과"를 표로 보여준다.
 */
const PerfBreakdownModal = ({ target, onClose }: Props) => {
  const vm = usePerfBreakdownViewModel(target);

  const compare = vm.compare;

  const handleCsv = () => {
    if (compare) {
      // 달성률 열은 관리자 토글이 켜진 경우에만(vm.showRate)
      downloadCsvFile(
        `실적상세_${vm.keyLabel}_계획실적비교_${new Date().toISOString().slice(0, 10)}.csv`,
        ['프로젝트코드', '프로젝트명', '팀', `${compare.plan_label}(억)`, `${compare.actual_label}(억)`,
          ...(vm.showRate ? ['달성률(%)'] : [])],
        compare.rows.map(r => [r.project_code, r.project_name, r.team, r.plan, r.actual,
          ...(vm.showRate ? [r.rate ?? ''] : [])]),
      );
      return;
    }
    downloadCsvFile(
      `실적상세_${vm.keyLabel}_${vm.seriesLabel}_${new Date().toISOString().slice(0, 10)}.csv`,
      ['프로젝트코드', '프로젝트명', '파트', '팀', `값(${vm.unit})`],
      vm.rows.map(r => [r.project_code, r.project_name, r.part, r.team, r.value]),
    );
  };

  const body = (() => {
    if (vm.isLoading)  return <div className={styles.state}>불러오는 중…</div>;
    if (vm.isError)    return <div className={styles.state}>데이터를 불러오지 못했습니다.</div>;
    if (!vm.available) return <div className={styles.state}>{vm.message ?? '표시할 데이터가 없습니다.'}</div>;

    // 계획·실적 짝이 있는 차트(파트별 계획 vs 추정 실적 / 파트별 매출 진행 현황)는 클릭한 막대와
    // 무관하게 항상 둘을 나란히 비교 — 어느 막대를 눌러도 "그 값 하나만 나열"에 그치지 않게 함
    if (compare) {
      if (!compare.rows.length) return <div className={styles.state}>이 파트에 집계된 프로젝트 행이 없습니다.</div>;

      const cols: BreakdownColumn<PerfBreakdownCompareRow>[] = [
        {
          key: 'code', header: '프로젝트코드',
          sortValue: r => r.project_code,
          render: r => r.project_code ? <CopyText text={r.project_code} /> : '—',
        },
        { key: 'team', header: '팀', align: 'center', sortValue: r => r.team, render: r => r.team || '—' },
        {
          key: 'plan', header: `${compare.plan_label} (억)`, align: 'right',
          sortValue: r => r.plan, render: r => fmtPerfBreakdown(r.plan),
        },
        {
          key: 'actual', header: `${compare.actual_label} (억)`, align: 'right',
          sortValue: r => r.actual, render: r => fmtPerfBreakdown(r.actual),
        },
        // 달성률 — 관리자용 기능 토글로만 노출(저조한 팀이 드러나지 않게 하는 배려, 2026-09-29)
        ...(vm.showRate ? [{
          key: 'rate', header: '달성률', align: 'right' as const,
          sortValue: (r: PerfBreakdownCompareRow) => r.rate ?? -1,
          render: (r: PerfBreakdownCompareRow) => (
            <span className={r.rate === null ? undefined : r.rate < 70 ? styles.rateLoss : r.rate >= 100 ? styles.rateGood : undefined}>
              {r.rate === null ? '—' : `${r.rate}%`}
            </span>
          ),
        }] : []),
      ];

      return (
        <>
          <div className={styles.explain}>
            <p className={styles.explainLead}>
              <b>{compare.plan_label}</b> = {compare.plan_field_desc} · <b>{compare.actual_label}</b> = {compare.actual_field_desc}
            </p>
            {vm.aggDesc && <p className={styles.explainSub}>{vm.aggDesc}</p>}
          </div>

          {/* 달성률 표시 중이면 백엔드 순서(달성률 낮은 순) 그대로(정렬 키를 없는 값으로), 숨김이면
              그 순서조차 저조한 프로젝트를 드러내므로 계획 큰 순으로 */}
          <BreakdownTable
            columns={cols}
            rows={compare.rows}
            totalLabel={vm.showRate
              ? `합계 (${compare.rows.length}건) · 달성률 ${compare.rate === null ? '—' : `${compare.rate}%`}`
              : `합계 (${compare.rows.length}건)`}
            totalValues={[
              fmtPerfBreakdown(compare.plan_total), fmtPerfBreakdown(compare.actual_total),
              ...(vm.showRate ? [compare.rate === null ? '—' : `${compare.rate}%`] : []),
            ]}
            totalSpan={2}
            defaultSortKey={vm.showRate ? 'backend-order' : 'plan'}
          />

          <div className={styles.foot}>
            <span className={styles.count}>{vm.showRate ? '달성률 낮은 프로젝트가 위로 정렬 · 매출행 기준' : '계획 큰 순 · 매출행 기준'}</span>
            <Button variant="success" size="sm" onClick={handleCsv}>↓ 이 목록 CSV</Button>
          </div>
        </>
      );
    }

    if (!vm.rows.length) return <div className={styles.state}>이 막대에 집계된 프로젝트 행이 없습니다.</div>;

    const cols: BreakdownColumn<PerfBreakdownRow>[] = [
      {
        // 코드만 보이게 좁게 — 프로젝트명까지 붙이면 컬럼이 넓어져 가로스크롤 유발 (KPI 드릴다운
        // 모달과 동일 이유로 통일)
        key: 'code', header: '프로젝트코드',
        sortValue: r => r.project_code,
        render: r => r.project_code ? <CopyText text={r.project_code} /> : '—',
      },
      { key: 'part', header: '파트', align: 'center', sortValue: r => stripPartPrefix(r.part), render: r => stripPartPrefix(r.part) || '—' },
      { key: 'team', header: '팀',   align: 'center', sortValue: r => r.team, render: r => r.team || '—' },
      {
        key: 'value', header: `값 (${vm.unit})`, align: 'right',
        sortValue: r => r.value,
        render: r => (Number.isInteger(r.value) ? r.value.toLocaleString() : r.value),
      },
    ];

    return (
      <>
        {(vm.fieldDesc || vm.aggDesc) && (
          <div className={styles.explain}>
            {vm.fieldDesc && (
              <p className={styles.explainLead}>
                <b>{vm.seriesLabel}</b> 막대 = {vm.fieldDesc}
              </p>
            )}
            {vm.aggDesc && <p className={styles.explainSub}>{vm.aggDesc}</p>}
          </div>
        )}

        <BreakdownTable
          columns={cols}
          rows={vm.rows}
          totalLabel={`합계 (${vm.count}건)`}
          totalValue={vm.totalStr}
          totalSpan={3}
        />

        <div className={styles.foot}>
          <span className={styles.count}>매출/원가 행 기준 합산 · 막대값과 동일</span>
          <Button variant="success" size="sm" onClick={handleCsv}>↓ 이 목록 CSV</Button>
        </div>

        {vm.glossary.length > 0 && (
          <details className={styles.glossary}>
            <summary>이 표의 값이 어떻게 만들어지나 · 용어</summary>
            <dl>
              {vm.glossary.map(g => (
                <div key={g.term} className={styles.term}>
                  <dt>{g.term}</dt>
                  <dd>
                    <code>{g.formula}</code>
                    <span>{g.note}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </>
    );
  })();

  // 스크롤 잠금·ESC(겹쳐 떠도 이 모달만 닫힘)·퇴장 애니메이션은 Modal이 처리
  return (
    <Modal
      onClose={onClose}
      title={`${vm.dimLabel} · ${vm.keyLabel}`}
      sub={<>
        {compare ? (
          <>
            <ModalBadge>{compare.plan_label}</ModalBadge>
            <ModalBadge>{compare.actual_label}</ModalBadge>
          </>
        ) : (
          <ModalBadge>{vm.seriesLabel || '값'}</ModalBadge>
        )}
        {vm.available && '합계로 산출'}
      </>}
    >
      {body}
    </Modal>
  );
};

export default PerfBreakdownModal;
