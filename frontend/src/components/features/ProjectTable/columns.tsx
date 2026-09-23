import { createColumnHelper } from '@tanstack/react-table';
import type { Project } from '@/types';
import { formatBillion, formatRate, getNoteVariant } from '@/utils';
import { Badge, NegCell, CopyText, HighlightText, alertDialog } from '@/components/ui';
import { openFinanceFile } from '@/api/finance.api';

const openFile = (filename: string) => {
  openFinanceFile(filename).then(r => { if (!r.ok) alertDialog(r.message ?? '파일을 열 수 없습니다.', { error: true }); });
};

const h = createColumnHelper<Project>();

// 매출·직접원가는 "완료" 단계에도 항상 채워지는 값. 그 외 이익 관련 컬럼은 "완료" PPT
// 양식상 원래 안 채우는 항목이라 0이면(=값 없음) 셀을 회색 음영 처리 — 원본 엑셀 음영
// 처리와 같은 의미. 값이 있으면(휴먼에러 후보) 음영 없이 그대로 노출해 눈에 띄게 함
// (2026-09-22, 처음엔 대시(-)로 했다가 "덜 눈에 띈다"는 피드백으로 셀 음영으로 변경)
const isFinishedEmpty = (row: Project, key: keyof Project) => row.stage === '완료' && !row[key];

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
  h.accessor('expenditure',  { header: '지출',
    meta: { cellMuted: row => isFinishedEmpty(row, 'expenditure') },
    cell: i => isFinishedEmpty(i.row.original, 'expenditure') ? '' : formatBillion(i.getValue()) }),
  h.accessor('direct_cost',  { header: '직접원가', cell: i => formatBillion(i.getValue()) }),
  h.accessor('labor_cost',   { header: '인건비',
    meta: { cellMuted: row => isFinishedEmpty(row, 'labor_cost') },
    cell: i => isFinishedEmpty(i.row.original, 'labor_cost') ? '' : formatBillion(i.getValue()) }),
  h.accessor('overhead',     { header: '공통원가',
    meta: { cellMuted: row => isFinishedEmpty(row, 'overhead') },
    cell: i => isFinishedEmpty(i.row.original, 'overhead') ? '' : formatBillion(i.getValue()) }),
  h.accessor('operating_profit', {
    header: '경상이익',
    meta: { cellMuted: row => isFinishedEmpty(row, 'operating_profit') },
    cell: i => isFinishedEmpty(i.row.original, 'operating_profit') ? '' : <NegCell v={i.getValue()} text={formatBillion(i.getValue())} />,
  }),
  h.accessor('profit_rate', {
    header: '이익율(%)',
    meta: { cellMuted: row => isFinishedEmpty(row, 'profit_rate') },
    cell: i => isFinishedEmpty(i.row.original, 'profit_rate') ? '' : <NegCell v={i.getValue()} text={formatRate(i.getValue())} />,
  }),
  h.accessor('note', {
    header: '비고',
    meta: { cellPopup: true },
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
    meta: { onOpenFile: openFile, cellPopup: true },
  }),
];
