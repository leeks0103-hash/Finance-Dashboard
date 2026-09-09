import { createColumnHelper } from '@tanstack/react-table';
import { HighlightText } from '@/components/ui';
import type { HideableColumn } from '@/components/ui/DataTable';
import type { PerfProject } from '@/types/performance.types';
import { formatEok, formatPctRaw, formatNum, PERF_MONTH } from '@/utils';

const h = createColumnHelper<PerfProject>();

// utils/format.ts의 공통 포맷 함수 단축 alias
const eok = (v: number) => formatEok(v);
const pct = (v: number) => formatPctRaw(v);
const num = (v: number) => formatNum(v);
// 텍스트 컬럼 — 검색 매치 하이라이트
const txt = (i: { getValue: () => unknown; table: { options: { meta?: { searchQuery?: string } } } }) =>
  <HighlightText text={String(i.getValue() ?? '')} query={i.table.options.meta?.searchQuery} />;

// 점검 월별 컬럼(chk_m01~chk_m12) — 1월~12월
const MONTH_COLS = Array.from({ length: 12 }, (_, i) => {
  const mm = String(i + 1).padStart(2, '0');
  return h.accessor(`chk_m${mm}` as keyof PerfProject & string, {
    header: `${i + 1}월`, size: 68, cell: c => eok(c.getValue() as number),
  });
});

export const perfColumns = [
  // ── 기본 표시 (사용자 지정 32개) — 프로젝트코드는 sticky 첫 컬럼이라 맨 앞 유지 ──
  h.accessor('project_code', {
    header: '프로젝트코드', size: 164,
    enableSorting: true,
    cell: txt,
  }),
  h.accessor('progress',     { header: '진행',       size: 78,  cell: txt }),
  h.accessor('category',     { header: '매출/원가',  size: 84,  cell: txt }),
  h.accessor('project_name', { header: '프로젝트명', size: 320, cell: txt }),
  h.accessor('manager',      { header: '담당자',     size: 78,  cell: txt }),
  h.accessor('plan_initial',      { header: '최초사업계획', size: 96, enableSorting: true, cell: i => eok(i.getValue()) }),
  h.accessor('plan_diff_amount',  { header: '계획 대비 추정 실적 차이 금액', size: 180, cell: i => eok(i.getValue()) }),
  h.accessor('plan_diff_rate',    { header: '증감률', size: 76, cell: i => i.getValue() ? `${((i.getValue() as number)*100).toFixed(1)}%` : '-' }),
  h.accessor('cost_direct',       { header: '직접원가', size: 84, cell: i => eok(i.getValue()) }),
  h.accessor('cost_labor',        { header: '인건비',   size: 76, cell: i => eok(i.getValue()) }),
  h.accessor('cost_overhead',     { header: '공통원가', size: 84, cell: i => eok(i.getValue()) }),
  h.accessor('cost_mgmt',         { header: '관리비',   size: 76, cell: i => eok(i.getValue()) }),
  h.accessor('operating_profit',  { header: '경상손익', size: 84, enableSorting: true, cell: i => eok(i.getValue()) }),
  h.accessor('profit_rate',       { header: '손익률',   size: 76, enableSorting: true, cell: i => i.getValue() ? `${(Math.round((i.getValue() as number) * 100) / 100).toFixed(2)}%` : '-' }),
  h.accessor('jun_check_total',   { header: '합계',     size: 96, cell: i => eok(i.getValue()) }),
  ...MONTH_COLS,
  h.accessor('chk_cost_rate',   { header: '원가율', size: 78, cell: i => pct(i.getValue()) }),
  h.accessor('chk_course',      { header: '과정',   size: 66, cell: i => num(i.getValue()) }),
  h.accessor('chk_session',     { header: '차수',   size: 66, cell: i => num(i.getValue()) }),
  h.accessor('chk_participant', { header: '인원',   size: 66, cell: i => num(i.getValue()) }),
  h.accessor('change_note',     { header: '변동 검토의견', size: 240, cell: txt }),

  // ── 기본 숨김 (컬럼 메뉴에서 체크하면 표시) ──
  h.accessor('part',         { header: '파트',         size: 128, cell: txt }),
  h.accessor('team',         { header: '팀',           size: 172, cell: txt }),
  h.accessor('tech_category',{ header: '미래기술분류', size: 148, cell: txt }),
  h.accessor('biz_type',     { header: '사업구분',     size: 116, cell: txt }),
  h.accessor('customer_type',{ header: '고객구분',     size: 136, cell: txt }),
  h.accessor('biz_plan',     { header: '사업계획',     size: 88,  cell: txt }),
  h.accessor('edu_type',     { header: '교육형태',     size: 128, cell: txt }),
  h.accessor('biz_type2',    { header: '사업유형',     size: 116, cell: txt }),
  h.accessor('budget_code',  { header: '예산코드',     size: 116, cell: txt }),
  h.accessor('actual_2025',       { header: '25년 실적',  size: 84, enableSorting: true, cell: i => eok(i.getValue()) }),
  h.accessor('plan_cost_rate',    { header: '계획원가율', size: 80, cell: i => pct(i.getValue()) }),
  h.accessor('course_count',      { header: '계획과정',   size: 74, cell: i => num(i.getValue()) }),
  h.accessor('session_count',     { header: '계획차수',   size: 74, cell: i => num(i.getValue()) }),
  h.accessor('participant_count', { header: '계획인원',   size: 74, cell: i => num(i.getValue()) }),
  h.accessor('jun_est',        { header: `${PERF_MONTH} 추정`,   size: 84, cell: i => eok(i.getValue()) }),
  h.accessor('jun_est_rate',   { header: `${PERF_MONTH} 추정율`, size: 80, cell: i => pct(i.getValue()) }),
  h.accessor('jun_actual',     { header: `${PERF_MONTH} 실적`,   size: 84, enableSorting: true, cell: i => eok(i.getValue()) }),
  h.accessor('jun_cost_rate',  { header: `${PERF_MONTH} 원가율`, size: 80, cell: i => pct(i.getValue()) }),
  h.accessor('cost_rate_diff', { header: '원가율 차이', size: 84, cell: i => i.getValue() ? `${((i.getValue() as number) * 100).toFixed(1)}%p` : '-' }),
  h.accessor('est_vs_actual',  { header: '추정 대비',   size: 84, cell: i => eok(i.getValue()) }),
  h.accessor('cost_rate_reason',{ header: '원가율 사유', size: 200, cell: txt }),
  h.accessor('plan_diff_reason', { header: '사유',     size: 180, cell: txt }),
  h.accessor('profit_gross',      { header: '매출이익',  size: 84, cell: i => eok(i.getValue()) }),
  h.accessor('balance_amount', { header: '대차금액', size: 84,  cell: i => eok(i.getValue()) }),
  h.accessor('balance_rate',   { header: '대차비율', size: 76,  cell: i => i.getValue() ? `${((i.getValue() as number)*100).toFixed(1)}%` : '-' }),
  h.accessor('dup_check',      { header: '중복점검', size: 200, cell: txt }),
  h.accessor('ref_code',       { header: '참조코드', size: 220, cell: txt }),
  // 신사업 직접원가
  h.accessor('sa_direct_total',    { header: '직접원가 소계', cell: i => num(i.getValue()) }),
  h.accessor('sa_instructor',      { header: '강사비',        cell: i => num(i.getValue()) }),
  h.accessor('sa_sub_instructor',  { header: '보조강사비',    cell: i => num(i.getValue()) }),
  h.accessor('sa_venue',           { header: '강의장',        cell: i => num(i.getValue()) }),
  h.accessor('sa_practice',        { header: '실습비',        cell: i => num(i.getValue()) }),
  h.accessor('sa_textbook',        { header: '교재비',        cell: i => num(i.getValue()) }),
  h.accessor('sa_other_direct',    { header: '기타직접',      cell: i => num(i.getValue()) }),
  // 신사업 공통원가
  h.accessor('sa_overhead_total',  { header: '공통원가 소계', cell: i => num(i.getValue()) }),
  h.accessor('sa_refreshment',     { header: '다과비',        cell: i => num(i.getValue()) }),
  h.accessor('sa_edu_venue',       { header: '교육장',        cell: i => num(i.getValue()) }),
  h.accessor('sa_parking',         { header: '주차비',        cell: i => num(i.getValue()) }),
  h.accessor('sa_sw_practice',     { header: '실습비SW',      cell: i => num(i.getValue()) }),
  h.accessor('sa_intern',          { header: '인턴인건비',    cell: i => num(i.getValue()) }),
  // 인건비
  h.accessor('sa_labor_total',     { header: '인건비 소계', cell: i => num(i.getValue()) }),
  h.accessor('sa_regular',         { header: '정규직',      cell: i => num(i.getValue()) }),
  h.accessor('sa_overhead_cost',   { header: '제경비',      cell: i => num(i.getValue()) }),
  // 기타
  h.accessor('note',        { header: '비고', size: 280, cell: txt }),
  h.accessor('filename',    { header: '원본파일명', size: 300, cell: txt }),
];

/** 기본 표시 컬럼 — 이 목록에 없는 컬럼은 전부 기본 숨김(컬럼 메뉴에서 체크하면 표시) */
export const PERF_VISIBLE: string[] = [
  'project_code', 'progress', 'category', 'project_name', 'manager',
  'plan_initial', 'plan_diff_amount', 'plan_diff_rate',
  'cost_direct', 'cost_labor', 'cost_overhead', 'cost_mgmt',
  'operating_profit', 'profit_rate', 'jun_check_total',
  ...Array.from({ length: 12 }, (_, i) => `chk_m${String(i + 1).padStart(2, '0')}`),
  'chk_cost_rate', 'chk_course', 'chk_session', 'chk_participant', 'change_note',
];

const _visibleSet = new Set(PERF_VISIBLE);

const _colId = (c: unknown) => (c as { accessorKey: string }).accessorKey;

/** DataTable initialColumnVisibility 용 — 기본 숨김 컬럼을 false로 */
export const PERF_DEFAULT_HIDDEN: Record<string, boolean> = Object.fromEntries(
  perfColumns.map(_colId).filter(id => !_visibleSet.has(id)).map(id => [id, false]),
);

/** 숨김/표시 토글 가능한 컬럼 — perfColumns에서 자동 파생(프로젝트코드는 항상 표시) */
export const PERF_HIDEABLE_COLS: HideableColumn[] = perfColumns
  .map(c => ({ id: _colId(c), label: String((c as { header?: unknown }).header ?? '') }))
  .filter(c => c.id !== 'project_code');
