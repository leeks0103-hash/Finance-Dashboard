import { createColumnHelper } from '@tanstack/react-table';
import type { Project } from '@/types';
import { formatBillion, formatRate } from '@/utils';
import { Badge } from '@/components/ui';

const h = createColumnHelper<Project>();

/** M-17: 음수 값은 var(--loss) 빨강 + 볼드로 표시 */
const NegCell = ({ v, text }: { v: number; text: string }) =>
  v < 0
    ? <span style={{ color: 'var(--loss)', fontWeight: 600 }}>{text}</span>
    : <>{text}</>;

export const columns = [
  h.accessor('project_code', { header: '프로젝트코드' }),
  h.accessor('year',         { header: '연도' }),
  h.accessor('part',  { header: '파트',  cell: i => <Badge label={i.getValue()} variant="part"  /> }),
  h.accessor('stage', { header: '단계',  cell: i => <Badge label={i.getValue()} variant="stage" /> }),
  h.accessor('revenue',      { header: '매출',     cell: i => formatBillion(i.getValue()) }),
  h.accessor('expenditure',  { header: '지출',     cell: i => formatBillion(i.getValue()) }),
  h.accessor('direct_cost',  { header: '직접원가', cell: i => formatBillion(i.getValue()) }),
  h.accessor('labor_cost',   { header: '인건비',   cell: i => formatBillion(i.getValue()) }),
  h.accessor('overhead',     { header: '공통원가', cell: i => formatBillion(i.getValue()) }),
  h.accessor('operating_profit', {
    header: '경상이익',
    cell: i => <NegCell v={i.getValue()} text={formatBillion(i.getValue())} />,
  }),
  h.accessor('profit_rate', {
    header: '이익율(%)',
    cell: i => <NegCell v={i.getValue()} text={formatRate(i.getValue())} />,
  }),
  h.accessor('note', {
    header: '비고',
    cell: i => {
      const note = i.getValue() as string;
      if (!note) return null;
      if (note.includes('손실')) return <Badge label={note} variant="loss" />;
      if (note.includes('저수익')) return <Badge label={note} variant="warn" />;
      return <>{note}</>;
    },
  }),
];
