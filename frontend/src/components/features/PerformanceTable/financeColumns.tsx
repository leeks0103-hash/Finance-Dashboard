import { createColumnHelper } from '@tanstack/react-table';
import { CopyText, HighlightText, NegCell } from '@/components/ui';
import { downloadCsvFile } from '@/hooks/useExport';
import { formatMoney, formatPercent } from '@/utils';
import type { Project } from '@/types/finance.types';
import { openFinanceFileOrAlert } from '@/hooks/useOpenFile';

// 재무 데이터 검색 결과 · 재무 이력 2뎁스 패널이 같은 컬럼 정의를 공유 — 한쪽만 고치면
// 두 표 모양이 어긋나던 문제(2026-09-28, "2뎁스도 검색결과 테이블과 동일하게")

const openFile = openFinanceFileOrAlert;

const ch = createColumnHelper<Project>();

// 매출·직접원가는 "완료" 단계에도 항상 채워지는 값. 그 외 이익 관련 컬럼은 "완료" PPT
// 양식상 원래 안 채우는 항목이라 0이면(=값 없음) 셀을 회색 음영 처리하고 값도 비움 —
// 원본 엑셀 음영 처리와 같은 의미. 값이 있으면(휴먼에러 후보) 그대로 노출해 눈에 띄게 함
const isFinishedEmpty = (row: Project, key: keyof Project) => row.stage === '완료' && !row[key];

const muted = <span style={{ color: 'var(--text-muted)' }}>-</span>;

export const buildFinanceColumns = (searchTerm: string) => [
  ch.accessor('project_code', {
    header: '프로젝트코드', size: 150,
    cell: i => <CopyText text={i.getValue()} highlight={searchTerm} />,
  }),
  ch.accessor('part',  { header: '파트',     size: 70, cell: i => <HighlightText text={i.getValue()} query={searchTerm} /> }),
  ch.accessor('year',  { header: '연도',     size: 60 }),
  ch.accessor('stage', { header: '보고단계', size: 80 }),
  // 재무 금액 컬럼 — CSV 내보내기엔 원래 있었는데 화면 표에는 빠져 있던 것 보강
  // (프로젝트코드/파트/연도/단계/비고/파일명만 보이던 문제, 2026-09-22)
  ch.accessor('revenue',     { header: '매출',   size: 90, cell: i => formatMoney(i.getValue(), i.table.options.meta?.rawValues) }),
  ch.accessor('expenditure', { header: '지출',   size: 90,
    meta: { cellMuted: row => isFinishedEmpty(row, 'expenditure') },
    cell: i => isFinishedEmpty(i.row.original, 'expenditure') ? '' : formatMoney(i.getValue(), i.table.options.meta?.rawValues) }),
  ch.accessor('direct_cost', { header: '직접원가', size: 90, cell: i => formatMoney(i.getValue(), i.table.options.meta?.rawValues) }),
  ch.accessor('labor_cost',  { header: '인건비',  size: 90,
    meta: { cellMuted: row => isFinishedEmpty(row, 'labor_cost') },
    cell: i => isFinishedEmpty(i.row.original, 'labor_cost') ? '' : formatMoney(i.getValue(), i.table.options.meta?.rawValues) }),
  ch.accessor('overhead',    { header: '공통원가', size: 90,
    meta: { cellMuted: row => isFinishedEmpty(row, 'overhead') },
    cell: i => isFinishedEmpty(i.row.original, 'overhead') ? '' : formatMoney(i.getValue(), i.table.options.meta?.rawValues) }),
  ch.accessor('operating_profit', {
    header: '경상이익', size: 90,
    meta: { cellMuted: row => isFinishedEmpty(row, 'operating_profit') },
    cell: i => isFinishedEmpty(i.row.original, 'operating_profit') ? '' : <NegCell v={i.getValue()} text={formatMoney(i.getValue(), i.table.options.meta?.rawValues)} />,
  }),
  ch.accessor('profit_rate', {
    header: '이익율(%)', size: 80,
    meta: { cellMuted: row => isFinishedEmpty(row, 'profit_rate') },
    cell: i => isFinishedEmpty(i.row.original, 'profit_rate') ? '' : <NegCell v={i.getValue()} text={formatPercent(i.getValue(), i.table.options.meta?.rawValues)} />,
  }),
  ch.accessor('note',  {
    header: '비고', size: 200,
    meta: { cellPopup: true },
    cell: i => {
      const v = i.getValue();
      return v ? <HighlightText text={v} query={searchTerm} /> : muted;
    },
  }),
  ch.accessor('filename', {
    header: '파일명', size: 260,
    // 파일명이 길어서(20자↑) 클릭 시 DataTable 기본 팝업(복사 + 이 meta로 "바로가기" 버튼 추가)이 뜬다
    cell: i => {
      const v = i.getValue();
      return v ? <HighlightText text={v} query={searchTerm} /> : muted;
    },
    meta: { onOpenFile: openFile, cellPopup: true },
  }),
];

// 지금 화면에 뜬 행(로우데이터)을 그대로 CSV로 — 재무데이터 다운로드(원본 엑셀 전체)와는
// 별개로, "이 결과만" 받고 싶을 때 쓰는 용도
export const downloadFinanceCsv = (filePrefix: string, rows: Project[]) => {
  downloadCsvFile(
    `${filePrefix}_${new Date().toISOString().slice(0, 10)}.csv`,
    ['프로젝트코드', '연도', '파트', '보고단계', '비고', '파일명',
     '매출', '지출', '직접원가', '인건비', '공통원가', '경상이익', '이익율'],
    rows.map(r => [r.project_code, r.year, r.part, r.stage, r.note, r.filename,
      r.revenue, r.expenditure, r.direct_cost, r.labor_cost, r.overhead, r.operating_profit, r.profit_rate]),
  );
};
