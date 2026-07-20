import { createColumnHelper } from '@tanstack/react-table';
import type { Project } from '@/types';
import { formatBillion, formatRate } from '@/utils';

const h = createColumnHelper<Project>();

export const columns = [
  h.accessor('project_code', { header: '프로젝트코드' }),
  h.accessor('year',         { header: '연도' }),
  h.accessor('part',         { header: '파트' }),
  h.accessor('stage',        { header: '단계' }),
  h.accessor('revenue',      { header: '매출',     cell: i => formatBillion(i.getValue()) }),
  h.accessor('expenditure',  { header: '지출',     cell: i => formatBillion(i.getValue()) }),
  h.accessor('direct_cost',  { header: '직접원가', cell: i => formatBillion(i.getValue()) }),
  h.accessor('labor_cost',   { header: '인건비',   cell: i => formatBillion(i.getValue()) }),
  h.accessor('overhead',     { header: '공통원가', cell: i => formatBillion(i.getValue()) }),
  h.accessor('operating_profit', { header: '경상이익', cell: i => formatBillion(i.getValue()) }),
  h.accessor('profit_rate',  { header: '이익율(%)', cell: i => formatRate(i.getValue()) }),
  h.accessor('note',         { header: '비고' }),
];
