import { createColumnHelper } from '@tanstack/react-table';
import type { Project } from '@/types';
import { formatMoney, formatPercent, getNoteVariant } from '@/utils';
import { Badge, NegCell, CopyText, HighlightText } from '@/components/ui';
import { openFinanceFileOrAlert } from '@/hooks/useOpenFile';

const openFile = openFinanceFileOrAlert;

const h = createColumnHelper<Project>();

// 매출·직접원가는 "완료" 단계에도 항상 채워지는 값. 그 외 이익 관련 컬럼은 "완료" PPT
// 양식상 원래 안 채우는 항목이라 0이면(=값 없음) 셀을 회색 음영 처리 — 원본 엑셀 음영
// 처리와 같은 의미. 값이 있으면(휴먼에러 후보) 음영 없이 그대로 노출해 눈에 띄게 함
// (2026-09-22, 처음엔 대시(-)로 했다가 "덜 눈에 띈다"는 피드백으로 셀 음영으로 변경)
const isFinishedEmpty = (row: Project, key: keyof Project) => row.stage === '완료' && !row[key];

// 컬럼 기본 폭(size) = 리사이즈 핸들 더블클릭 auto-fit과 같은 계산식(헤더+32 / 셀 값+20, 60~400px)을
// 실데이터 240행 전체에 돌린 최댓값(2026-09-28, 헤드리스 Chrome + HyundaiSans 실측). 사용자가 매번
// 더블클릭으로 맞추던 폭이 사실상 고정값이라 기본값으로 박음. 비고·파일명은 400 상한
export const columns = [
  h.accessor('project_code', {
    header: '프로젝트코드', size: 134,
    cell: i => <CopyText text={i.getValue()} highlight={i.table.options.meta?.searchQuery} />,
  }),
  h.accessor('year', {
    header: '연도', size: 60,
    cell: i => <HighlightText text={i.getValue()} query={i.table.options.meta?.searchQuery} />,
  }),
  h.accessor('part',  { header: '파트', size: 62,  cell: i => <Badge label={i.getValue()} variant="part"  /> }),
  h.accessor('stage', { header: '단계', size: 63,  cell: i => <Badge label={i.getValue()} variant="stage" /> }),
  h.accessor('revenue',      { header: '매출', size: 90,     cell: i => formatMoney(i.getValue(), i.table.options.meta?.rawValues) }),
  h.accessor('expenditure',  { header: '지출', size: 90,
    meta: { cellMuted: row => isFinishedEmpty(row, 'expenditure') },
    cell: i => isFinishedEmpty(i.row.original, 'expenditure') ? '' : formatMoney(i.getValue(), i.table.options.meta?.rawValues) }),
  h.accessor('direct_cost',  { header: '직접원가', size: 90, cell: i => formatMoney(i.getValue(), i.table.options.meta?.rawValues) }),
  h.accessor('labor_cost',   { header: '인건비', size: 83,
    meta: { cellMuted: row => isFinishedEmpty(row, 'labor_cost') },
    cell: i => isFinishedEmpty(i.row.original, 'labor_cost') ? '' : formatMoney(i.getValue(), i.table.options.meta?.rawValues) }),
  h.accessor('overhead',     { header: '공통원가', size: 90,
    meta: { cellMuted: row => isFinishedEmpty(row, 'overhead') },
    cell: i => isFinishedEmpty(i.row.original, 'overhead') ? '' : formatMoney(i.getValue(), i.table.options.meta?.rawValues) }),
  h.accessor('operating_profit', {
    header: '경상이익', size: 83,
    meta: { cellMuted: row => isFinishedEmpty(row, 'operating_profit') },
    cell: i => isFinishedEmpty(i.row.original, 'operating_profit') ? '' : <NegCell v={i.getValue()} text={formatMoney(i.getValue(), i.table.options.meta?.rawValues)} />,
  }),
  h.accessor('profit_rate', {
    header: '이익율(%)', size: 76,
    meta: { cellMuted: row => isFinishedEmpty(row, 'profit_rate') },
    cell: i => isFinishedEmpty(i.row.original, 'profit_rate') ? '' : <NegCell v={i.getValue()} text={formatPercent(i.getValue(), i.table.options.meta?.rawValues)} />,
  }),
  h.accessor('note', {
    header: '비고', size: 400,
    meta: { cellPopup: true },
    cell: i => {
      const note = i.getValue() as string;
      const variant = getNoteVariant(note);
      if (!variant) return <>{note}</>;
      return <Badge label={note} variant={variant} />;
    },
  }),
  h.accessor('filename', {
    header: '원본파일명', size: 400,
    // 파일명이 길어서(20자↑) 클릭 시 DataTable 기본 팝업(복사 + 이 meta로 "바로가기" 버튼 추가)이 뜬다
    cell: i => <HighlightText text={i.getValue()} query={i.table.options.meta?.searchQuery} />,
    meta: { onOpenFile: openFile, cellPopup: true },
  }),
];
