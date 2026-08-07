import { createColumnHelper } from '@tanstack/react-table';
import { CopyText } from '@/components/ui';
import type { HideableColumn } from '@/components/ui/DataTable';
import type { PerfProject } from '@/types/performance.types';
import { formatEok, formatPctRaw, formatNum } from '@/utils';

const h = createColumnHelper<PerfProject>();

// utils/format.ts의 공통 포맷 함수 단축 alias
const eok = (v: number) => formatEok(v);
const pct = (v: number) => formatPctRaw(v);
const num = (v: number) => formatNum(v);

export const perfColumns = [
  // 식별 — 프로젝트코드 제일 앞 (sticky 첫 번째 컬럼)
  h.accessor('project_code', {
    header: '프로젝트코드',
    enableSorting: true,
    cell: i => <CopyText text={i.getValue()} />,
  }),
  h.accessor('part',         { header: '파트' }),
  h.accessor('team',         { header: '팀' }),
  h.accessor('project_name', { header: '프로젝트명' }),
  h.accessor('manager',      { header: '담당자' }),
  h.accessor('tech_category',{ header: '미래기술분류' }),
  h.accessor('biz_type',     { header: '사업구분' }),
  h.accessor('customer_type',{ header: '고객구분' }),
  h.accessor('biz_plan',     { header: '사업계획' }),
  h.accessor('progress',     { header: '진행' }),
  h.accessor('edu_type',     { header: '교육형태' }),
  h.accessor('biz_type2',    { header: '사업유형' }),
  h.accessor('budget_code',  { header: '예산코드' }),
  // 재무
  h.accessor('actual_2025',       { header: '25년 실적',    enableSorting: true, cell: i => eok(i.getValue()) }),
  h.accessor('plan_initial',      { header: '최초계획',     enableSorting: true, cell: i => eok(i.getValue()) }),
  h.accessor('plan_cost_rate',    { header: '계획원가율',   cell: i => pct(i.getValue()) }),
  h.accessor('course_count',      { header: '과정',         cell: i => num(i.getValue()) }),
  h.accessor('session_count',     { header: '차수',         cell: i => num(i.getValue()) }),
  h.accessor('participant_count', { header: '인원',         cell: i => num(i.getValue()) }),
  // 6월 집계
  h.accessor('jun_est',        { header: '6월 추정',    cell: i => eok(i.getValue()) }),
  h.accessor('jun_est_rate',   { header: '6월 추정율',  cell: i => pct(i.getValue()) }),
  h.accessor('jun_actual',     { header: '6월 실적',    enableSorting: true, cell: i => eok(i.getValue()) }),
  h.accessor('jun_cost_rate',  { header: '6월 원가율',  cell: i => pct(i.getValue()) }),
  h.accessor('cost_rate_diff', { header: '원가율 차이', cell: i => i.getValue() ? `${((i.getValue() as number) * 100).toFixed(1)}%p` : '-' }),
  h.accessor('est_vs_actual',  { header: '추정 대비',   cell: i => eok(i.getValue()) }),
  h.accessor('cost_rate_reason',{ header: '원가율 사유' }),
  // 차이분석
  h.accessor('plan_diff_amount', { header: '차이금액', cell: i => eok(i.getValue()) }),
  h.accessor('plan_diff_rate',   { header: '증감율',   cell: i => i.getValue() ? `${((i.getValue() as number)*100).toFixed(1)}%` : '-' }),
  h.accessor('plan_diff_reason', { header: '사유' }),
  // 손익 점검
  h.accessor('profit_gross',      { header: '매출이익',  cell: i => eok(i.getValue()) }),
  h.accessor('cost_direct',       { header: '직접원가',  cell: i => eok(i.getValue()) }),
  h.accessor('cost_labor',        { header: '인건비',    cell: i => eok(i.getValue()) }),
  h.accessor('cost_overhead',     { header: '공통원가',  cell: i => eok(i.getValue()) }),
  h.accessor('cost_mgmt',         { header: '관리비',    cell: i => eok(i.getValue()) }),
  h.accessor('operating_profit',  { header: '경상손익',  enableSorting: true, cell: i => eok(i.getValue()) }),
  h.accessor('profit_rate',       { header: '손익률',    enableSorting: true, cell: i => i.getValue() ? `${(Math.round((i.getValue() as number) * 100) / 100).toFixed(2)}%` : '-' }),
  // 6월 점검 — 월별 상세는 차트에서 표시하므로 연간합계만
  h.accessor('jun_check_total', { header: '6월 점검 연간', cell: i => eok(i.getValue()) }),
  h.accessor('chk_cost_rate',   { header: '점검원가율', cell: i => pct(i.getValue()) }),
  h.accessor('chk_course',      { header: '점검과정',   cell: i => num(i.getValue()) }),
  h.accessor('chk_session',     { header: '점검차수',   cell: i => num(i.getValue()) }),
  h.accessor('chk_participant', { header: '점검인원',   cell: i => num(i.getValue()) }),
  // 대차·참조
  h.accessor('balance_amount', { header: '대차금액', cell: i => eok(i.getValue()) }),
  h.accessor('balance_rate',   { header: '대차비율', cell: i => i.getValue() ? `${((i.getValue() as number)*100).toFixed(1)}%` : '-' }),
  h.accessor('dup_check',      { header: '중복점검' }),
  h.accessor('ref_code',       { header: '참조코드' }),
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
  h.accessor('change_note', { header: '변동 검토의견' }),
  h.accessor('note',        { header: '비고' }),
  h.accessor('filename',    { header: '원본파일명', cell: i => <CopyText text={i.getValue() ?? ''} /> }),
];

/**
 * 숨김 가능 컬럼 목록 — perfColumns와 함께 관리
 * 컬럼 추가/삭제 시 여기도 함께 업데이트
 */
export const PERF_HIDEABLE_COLS: HideableColumn[] = [
  // 식별 보조
  { id: 'tech_category',    label: '미래기술분류' },
  { id: 'biz_type',         label: '사업구분' },
  { id: 'customer_type',    label: '고객구분' },
  { id: 'edu_type',         label: '교육형태' },
  { id: 'biz_type2',        label: '사업유형' },
  { id: 'budget_code',      label: '예산코드' },
  // 추정·차이분석
  { id: 'jun_est',          label: '6월 추정' },
  { id: 'jun_est_rate',     label: '6월 추정율' },
  { id: 'cost_rate_diff',   label: '원가율 차이' },
  { id: 'est_vs_actual',    label: '추정 대비' },
  { id: 'cost_rate_reason', label: '원가율 사유' },
  { id: 'plan_diff_amount', label: '차이금액' },
  { id: 'plan_diff_rate',   label: '증감율' },
  { id: 'plan_diff_reason', label: '사유' },
  // 손익 세부
  { id: 'profit_gross',     label: '매출이익' },
  { id: 'cost_direct',      label: '직접원가' },
  { id: 'cost_labor',       label: '인건비' },
  { id: 'cost_overhead',    label: '공통원가' },
  { id: 'cost_mgmt',        label: '관리비' },
  // 6월 점검 세부
  { id: 'chk_cost_rate',    label: '점검원가율' },
  { id: 'chk_course',       label: '점검과정' },
  { id: 'chk_session',      label: '점검차수' },
  { id: 'chk_participant',  label: '점검인원' },
  // 대차·참조
  { id: 'balance_amount',   label: '대차금액' },
  { id: 'balance_rate',     label: '대차비율' },
  { id: 'dup_check',        label: '중복점검' },
  { id: 'ref_code',         label: '참조코드' },
  // 신사업 원가 세부
  { id: 'sa_direct_total',  label: '직접원가 소계' },
  { id: 'sa_instructor',    label: '강사비' },
  { id: 'sa_sub_instructor',label: '보조강사비' },
  { id: 'sa_venue',         label: '강의장' },
  { id: 'sa_practice',      label: '실습비' },
  { id: 'sa_textbook',      label: '교재비' },
  { id: 'sa_other_direct',  label: '기타직접' },
  { id: 'sa_overhead_total',label: '공통원가 소계' },
  { id: 'sa_refreshment',   label: '다과비' },
  { id: 'sa_edu_venue',     label: '교육장비' },
  { id: 'sa_parking',       label: '주차비' },
  { id: 'sa_sw_practice',   label: '실습비SW' },
  { id: 'sa_intern',        label: '인턴인건비' },
  { id: 'sa_labor_total',   label: '인건비 소계' },
  { id: 'sa_regular',       label: '정규직' },
  { id: 'sa_overhead_cost', label: '제경비' },
  { id: 'change_note',      label: '변동 검토의견' },
  { id: 'note',             label: '비고' },
  { id: 'filename',         label: '원본파일명' },
];
