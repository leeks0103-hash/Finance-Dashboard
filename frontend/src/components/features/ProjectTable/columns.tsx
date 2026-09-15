import { createColumnHelper } from '@tanstack/react-table';
import type { Project } from '@/types';
import { formatBillion, formatRate, getNoteVariant } from '@/utils';
import { Badge, NegCell, CopyText, HighlightText } from '@/components/ui';
import { openFinanceFile } from '@/api/finance.api';

const openFile = (filename: string) => {
  openFinanceFile(filename).then(r => { if (!r.ok) window.alert(r.message ?? '파일을 열 수 없습니다.'); });
};

const h = createColumnHelper<Project>();

export const columns = [
  h.accessor('project_code', {
    header: '프로젝트코드',
    cell: i => <CopyText text={i.getValue()} highlight={i.table.options.meta?.searchQuery} />,
  }),
  h.accessor('year', {
    header: '연도',
    cell: i => <HighlightText text={i.getValue()} query={i.table.options.meta?.searchQuery} />,
  }),
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
      const variant = getNoteVariant(note);
      if (!variant) return <>{note}</>;
      return <Badge label={note} variant={variant} />;
    },
  }),
  h.accessor('filename', {
    header: '원본파일명',
    // 파일명이 길어서(20자↑) 클릭 시 DataTable 기본 팝업(복사 + 이 meta로 "바로가기" 버튼 추가)이 뜬다
    cell: i => <HighlightText text={i.getValue()} query={i.table.options.meta?.searchQuery} />,
    meta: { onOpenFile: openFile },
  }),
];
