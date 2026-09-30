import { createColumnHelper } from '@tanstack/react-table';
import { Button, CopyText, DataTable, Modal } from '@/components/ui';
import { downloadCsvFile } from '@/hooks/useExport';
import type { FinanceBreakdownRow } from '@/api/finance.api';
import {
  useFinanceBreakdownViewModel,
  type FinanceBreakdownTarget,
} from '@/hooks/viewmodels/useFinanceBreakdownViewModel';
import { BreakdownGate } from '@/components/features/BreakdownModal/BreakdownParts';
import styles from './FinanceBreakdownModal.module.css';
import { openFinanceFileOrAlert } from '@/hooks/useOpenFile';

interface Props {
  target:  FinanceBreakdownTarget;
  onClose: () => void;
}

const openFile = openFinanceFileOrAlert;

const fmtValue = (v: number, unit: string) =>
  unit === '%' ? `${v}%` : `${v.toLocaleString()}억원`;

const h = createColumnHelper<FinanceBreakdownRow>();

/**
 * 재무(경영실적/재무데이터) 차트 막대/조각을 클릭하면 열리는 드릴다운 모달 (KPI·실적현황과 동일 패턴).
 * "이 막대 값 = 어떤 프로젝트 행들을 합산한 결과"를 표로 보여준다.
 */
const FinanceBreakdownModal = ({ target, onClose }: Props) => {
  const vm = useFinanceBreakdownViewModel(target);

  const columns = [
    h.accessor('project_code', {
      header: '프로젝트코드', size: 190,
      cell: i => <div className={styles.centerCell}><CopyText text={i.getValue()} /></div>,
    }),
    h.accessor('filename', {
      header: '파일명', size: 340,
      cell: i => {
        const v = i.getValue();
        return <div className={styles.centerCell}>{v ? <CopyText text={v} onOpen={openFile} /> : '—'}</div>;
      },
    }),
    h.accessor('part', {
      header: '파트', size: 90,
      cell: i => <div className={styles.centerCell}>{i.getValue() || '—'}</div>,
    }),
    h.accessor('stage', {
      header: '보고단계', size: 90,
      cell: i => <div className={styles.centerCell}>{i.getValue() || '—'}</div>,
    }),
    h.accessor('value', {
      header: `값 (${vm.unit})`, size: 120,
      cell: i => <div className={styles.valueCell}>{fmtValue(i.getValue(), vm.unit)}</div>,
    }),
  ];

  const handleCsv = () => {
    downloadCsvFile(
      `재무상세_${vm.keyLabel}_${vm.fieldLabel}_${new Date().toISOString().slice(0, 10)}.csv`,
      ['프로젝트코드', '파일명', '파트', '보고단계', `값(${vm.unit})`],
      vm.rows.map(r => [r.project_code, r.filename, r.part, r.stage, r.value]),
    );
  };

  const body = (
    <BreakdownGate vm={vm} empty={!vm.rows.length} emptyText="이 항목에 집계된 프로젝트 행이 없습니다.">
      <DataTable<FinanceBreakdownRow>
        data={vm.rows}
        columns={columns as never}
        getRowId={r => `${r.project_code}-${r.filename}`}
        compact
        hideToolbar
        defaultPageSize={vm.rows.length}
        pageSizeOptions={[vm.rows.length]}
        storageKey="finance-breakdown"
        footer={{ value: <div className={styles.valueCell}>합계 {fmtValue(Number(vm.totalStr.replace(/,/g, '')), vm.unit)}</div> }}
      />
    </BreakdownGate>
  );
  const hasRows = !vm.isLoading && !vm.isError && vm.available && vm.rows.length > 0;

  return (
    <Modal
      onClose={onClose}
      width={1000}
      title={`${vm.dimLabel} · ${vm.keyLabel || '전체'}`}
      sub={`${vm.fieldLabel} 합계 = ${vm.totalStr}${vm.unit === '%' ? '%' : '억원'} (${vm.count}건)`}
      className={styles.modal}
      footer={hasRows && <Button variant="success" size="sm" onClick={handleCsv}>↓ 이 목록 CSV</Button>}
    >
      {body}
    </Modal>
  );
};

export default FinanceBreakdownModal;
