import type { ColumnDef } from '@tanstack/react-table';
import { Button, CopyText, DataTable, Modal } from '@/components/ui';
import { openFinanceFileOrAlert } from '@/hooks/useOpenFile';
import type { FinMismatchRow } from '@/types/performance.types';

const won = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('ko-KR') : '-');
const signed = (v: unknown) => (typeof v === 'number' ? `${v > 0 ? '+' : ''}${v.toLocaleString('ko-KR')}` : '-');

/** 금액 3칸(실적현황·재무 이력·차이) — 다른 값이면 세 칸 모두 빨간 칸(프로젝트 상세와 같은 cellFlag) */
const moneyCols = (
  label: string,
  perf: 'perf_revenue' | 'perf_cost',
  fin: 'fin_revenue' | 'fin_cost',
  diff: 'revenue_diff' | 'cost_diff',
  bad: (r: FinMismatchRow) => boolean,
): ColumnDef<FinMismatchRow, unknown>[] => {
  const flag = (r: FinMismatchRow) => (bad(r) ? `${label} 불일치` : undefined);
  return [
    { id: perf, accessorKey: perf, header: `당월 추정 ${label}(원)`, size: 132, cell: c => won(c.getValue()), meta: { cellFlag: flag } },
    { id: fin,  accessorKey: fin,  header: `재무 이력 ${label}(원)`, size: 132, cell: c => won(c.getValue()), meta: { cellFlag: flag } },
    { id: diff, accessorKey: diff, header: `${label} 차이(원)`,      size: 116,
      cell: c => (bad(c.row.original) ? signed(c.getValue()) : '일치'), meta: { cellFlag: flag } },
  ];
};

const COLUMNS: ColumnDef<FinMismatchRow, unknown>[] = [
  { id: 'project_code', accessorKey: 'project_code', header: '프로젝트코드', size: 176,
    cell: c => <CopyText text={String(c.getValue() ?? '')} centered /> },
  { id: 'project_name', accessorKey: 'project_name', header: '프로젝트명', size: 260 },
  { id: 'team',    accessorKey: 'team',    header: '팀',     size: 150 },
  { id: 'part',    accessorKey: 'part',    header: '파트',   size: 108 },
  { id: 'manager', accessorKey: 'manager', header: '담당자', size: 80 },
  ...moneyCols('매출',     'perf_revenue', 'fin_revenue', 'revenue_diff', r => r.revenue_mismatch),
  ...moneyCols('직접원가', 'perf_cost',    'fin_cost',    'cost_diff',    r => r.cost_mismatch),
  { id: 'fin_filename', accessorKey: 'fin_filename', header: '재무 보고서 파일명', size: 300,
    cell: c => <CopyText text={String(c.getValue() ?? '')} onOpen={openFinanceFileOrAlert} /> },
];

interface Props {
  rows: FinMismatchRow[];
  isLoading: boolean;
  onExportCsv: () => void;
  onClose: () => void;
}

/** 관리자 기능 > 완료 프로젝트 재무 불일치 — ⤢ 확대 보기(표). 관리자 기능 창 위에 한 겹 더 뜸(2026-10-06) */
const FinMismatchTableModal = ({ rows, isLoading, onExportCsv, onClose }: Props) => (
  <Modal
    title="완료 프로젝트 재무 불일치"
    sub="완료인데 실적현황 당월 추정 매출·직접원가가 재무 이력(완료 보고)과 1,000원 이상 다름 · 빨간 칸 = 다른 값"
    width="min(1880px, 96vw)"
    onClose={onClose}
  >
    <DataTable
      data={rows}
      columns={COLUMNS}
      getRowId={r => r.project_code + r.fin_filename}
      title="불일치 목록"
      storageKey="fin-mismatch"
      isLoading={isLoading}
      defaultPageSize={20}
      toolbarExtra={<Button variant="success" size="sm" onClick={onExportCsv}>↓ CSV</Button>}
    />
  </Modal>
);

export default FinMismatchTableModal;
