import { createPortal } from 'react-dom';
import { createColumnHelper } from '@tanstack/react-table';
import { Button, CopyText, DataTable, alertDialog } from '@/components/ui';
import { useScrollLock } from '@/components/ui/useScrollLock';
import { useEscToClose } from '@/components/ui/useEscToClose';
import { downloadCsvFile } from '@/hooks/useExport';
import { openFinanceFile } from '@/api/finance.api';
import type { FinanceBreakdownRow } from '@/api/finance.api';
import {
  useFinanceBreakdownViewModel,
  type FinanceBreakdownTarget,
} from '@/hooks/viewmodels/useFinanceBreakdownViewModel';
import styles from './FinanceBreakdownModal.module.css';

interface Props {
  target:  FinanceBreakdownTarget;
  onClose: () => void;
}

const openFile = (filename: string) => {
  openFinanceFile(filename).then(r => { if (!r.ok) alertDialog(r.message ?? '파일을 열 수 없습니다.', { error: true }); });
};

const fmtValue = (v: number, unit: string) =>
  unit === '%' ? `${v}%` : `${v.toLocaleString()}억원`;

const h = createColumnHelper<FinanceBreakdownRow>();

/**
 * 재무(경영실적/재무데이터) 차트 막대/조각을 클릭하면 열리는 드릴다운 모달 (KPI·실적현황과 동일 패턴).
 * "이 막대 값 = 어떤 프로젝트 행들을 합산한 결과"를 표로 보여준다.
 */
const FinanceBreakdownModal = ({ target, onClose }: Props) => {
  const vm = useFinanceBreakdownViewModel(target);

  useScrollLock();
  useEscToClose(onClose);

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

  const body = (() => {
    if (vm.isLoading)  return <div className={styles.state}>불러오는 중…</div>;
    if (vm.isError)    return <div className={styles.state}>데이터를 불러오지 못했습니다.</div>;
    if (!vm.available) return <div className={styles.state}>{vm.message ?? '표시할 데이터가 없습니다.'}</div>;
    if (!vm.rows.length) return <div className={styles.state}>이 항목에 집계된 프로젝트 행이 없습니다.</div>;

    return (
      <>
        <div className={styles.body}>
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
        </div>
        <div className={styles.foot}>
          <Button variant="success" size="sm" onClick={handleCsv}>↓ 이 목록 CSV</Button>
        </div>
      </>
    );
  })();

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.modal} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <div className={styles.title}>{vm.dimLabel} · {vm.keyLabel || '전체'}</div>
            <div className={styles.sub}>{vm.fieldLabel} 합계 = {vm.totalStr}{vm.unit === '%' ? '%' : '억원'} ({vm.count}건)</div>
          </div>
          <Button unstyled className={styles.close} onClick={onClose} aria-label="닫기">×</Button>
        </div>
        {body}
      </div>
    </div>,
    document.body,
  );
};

export default FinanceBreakdownModal;
