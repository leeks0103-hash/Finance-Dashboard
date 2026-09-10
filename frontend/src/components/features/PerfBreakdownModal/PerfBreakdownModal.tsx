import { createPortal } from 'react-dom';
import { Button } from '@/components/ui';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useEscToClose } from '@/hooks/useEscToClose';
import {
  usePerfBreakdownViewModel,
  type PerfBreakdownTarget,
} from '@/hooks/viewmodels/usePerfBreakdownViewModel';
import { downloadCsvFile } from '@/hooks/useExport';
import { stripPartPrefix } from '@/utils/format';
import type { PerfBreakdownRow } from '@/api/performance.api';
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

  useScrollLock();
  // ESC 닫기 — 차트 확대 모달 위에 겹쳐 떠도 이 모달만 닫힌다
  useEscToClose(onClose);

  const handleCsv = () => {
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
    if (!vm.rows.length) return <div className={styles.state}>이 막대에 집계된 프로젝트 행이 없습니다.</div>;

    const cols: BreakdownColumn<PerfBreakdownRow>[] = [
      {
        key: 'code', header: '프로젝트코드',
        sortValue: r => r.project_code,
        render: r => (
          <>
            {r.project_code || '—'}
            {r.project_name && <span className={styles.pname}> · {r.project_name}</span>}
          </>
        ),
      },
      { key: 'part', header: '파트', sortValue: r => stripPartPrefix(r.part), render: r => stripPartPrefix(r.part) || '—' },
      { key: 'team', header: '팀',   sortValue: r => r.team, render: r => r.team || '—' },
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

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.modal} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <h3 className={styles.title}>{vm.dimLabel} · {vm.keyLabel}</h3>
            <div className={styles.sub}>
              <span className={styles.badge}>{vm.seriesLabel || '값'}</span>
              {vm.available && '합계로 산출'}
            </div>
          </div>
          <Button unstyled className={styles.close} onClick={onClose} aria-label="닫기">×</Button>
        </div>
        <div className={styles.body}>{body}</div>
      </div>
    </div>,
    document.body,
  );
};

export default PerfBreakdownModal;
