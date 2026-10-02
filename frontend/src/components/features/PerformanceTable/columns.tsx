import { createColumnHelper } from '@tanstack/react-table';
import { HighlightText, CopyText } from '@/components/ui';
import type { HideableColumn } from '@/components/ui/DataTable';
import type { PerfProject } from '@/types/performance.types';
import { formatEokOrRaw, formatPctOrRaw, formatPercent, formatNum, stripPartPrefix } from '@/utils';
import { countFinanceHistory } from '@/utils/projectCode';
import styles from './columns.module.css';

const h = createColumnHelper<PerfProject>();

// utils/format.ts의 공통 포맷 함수 단축 alias — 금액·비율은 셀 컨텍스트를 받아 table meta의
// rawValues(설정 > 표 실제값 토글)가 켜져 있으면 억/만 축약·반올림 없이 원본 값으로 표시
type RawCtx = { getValue: () => unknown; table: { options: { meta?: { rawValues?: boolean } } } };
const eok = (i: RawCtx) => formatEokOrRaw(i.getValue() as number, i.table.options.meta?.rawValues);
const pct = (i: RawCtx) => formatPctOrRaw(i.getValue() as number, i.table.options.meta?.rawValues);
const num = (v: number) => formatNum(v);
// 억/만 단위로 축약 표시하는 금액 컬럼의 <td> title — 마우스오버 시 엑셀 원본 그대로의
// 정확한 금액(원 단위)을 보여줌. formatTitle은 <td> 하나에만 붙어서 위치에 따라 다른
// 값이 보이는 문제 없음(셀 안에 별도 title을 또 붙이면 안 됨)
const eokMeta = { formatTitle: (v: unknown) => {
  const n = Number(v);
  return n ? `${formatNum(Math.round(n * 1000))}원` : undefined;
} };
// 텍스트 컬럼 — 검색 매치 하이라이트
const txt = (i: { getValue: () => unknown; table: { options: { meta?: { searchQuery?: string } } } }) =>
  <HighlightText text={String(i.getValue() ?? '')} query={i.table.options.meta?.searchQuery} />;

// 완료 프로젝트 — 재무 이력(완료 단계)과 값이 다르면 빨간 칸 + 툴팁에 재무 값(백엔드 _attach_finance_mismatch)
const finFlag = (field: 'jun_check_total' | 'est_cost') => (r: PerfProject) => {
  if (!r.fin_mismatch?.includes(field)) return undefined;
  const fin = r[`fin_${field}`] as number | undefined;
  const perf = r[field] as number | undefined;
  const won = (v: number | undefined) => v == null ? '-' : `${formatNum(Math.round(v * 1000))}원`;
  const diff = perf != null && fin != null ? Math.round((perf - fin) * 1000) : undefined;
  return [
    `⚠ 재무 이력(완료 보고)과 ${field === 'jun_check_total' ? '매출' : '원가'} 금액 상이`,
    `· 실적현황: ${won(perf)}`,
    `· 재무 이력: ${won(fin)}`,
    diff != null ? `· 차이: ${diff > 0 ? '+' : ''}${formatNum(diff)}원` : '',
  ].filter(Boolean).join('\n');
};

// 재무 대조 모드(설정 토글) — 완료이면서 재무 완료 이력이 있는 줄의 비교 칸(실적현황·재무 이력 매출/직접원가) 테두리를 빛나게
const finGlow = (r: PerfProject) => r.progress === '완료' && (r.fin_jun_check_total != null || r.fin_est_cost != null);

// 재무 이력 건수 조회 결과 캐시 — 행마다 코드 목록을 다시 훑지 않도록 재사용.
// financeCodes 응답이 바뀌면(참조 변경) 캐시를 통째로 버린다.
let _fcRef: Record<string, number> | undefined;
let _fcCache = new Map<string, number>();
const financeCount = (code: string, codes?: Record<string, number>) => {
  if (codes !== _fcRef) { _fcRef = codes; _fcCache = new Map(); }
  return countFinanceHistory(code, codes, _fcCache);
};

/**
 * 프로젝트 상세 컬럼 — month는 기준월 라벨("8월"). 실제로 읽은 시트 기준(usePerfPeriod)이라 함수로 받음 —
 * 예전엔 "오늘 - 1개월" 상수라 10월 1일이 되자 아직 없는 9월로 머리글이 바뀌었음(2026-10-01)
 * (지금은 이 값을 쓰는 "N월 추정·실적" 컬럼이 주석 처리돼 _PERF_MONTH — 되살릴 때 이름을 PERF_MONTH로 되돌릴 것)
 */
const buildColumns = (_PERF_MONTH: string, finCompare: boolean) => [
  // ── 기본 표시 (2026-10-02 지정 순서) — 프로젝트당 한 줄(매출행 + 원가행의 사업계획 원가). 합계·1~12월은 삭제 ──
  h.accessor('project_code', {
    header: '프로젝트코드', size: 164,
    enableSorting: true,
    // 재무 PPT 이력이 있으면 건수 배지 — 더블클릭해야 2뎁스 유무를 알 수 있던 문제 해소
    cell: i => {
      const code = String(i.getValue() ?? '');
      const n = financeCount(code, i.table.options.meta?.financeCodes);
      // 재무 이력이 없으면 더블클릭해도 볼 게 없으니 클릭 한 번에 코드 복사(2026-09-30)
      if (n === 0 && code) {
        return <CopyText text={code} highlight={i.table.options.meta?.searchQuery} />;
      }
      return (
        <span className={styles.codeCell}>
          <HighlightText text={code} query={i.table.options.meta?.searchQuery} />
          {n > 0 && (
            <span className={styles.histBadge} title={`재무 이력 ${n}건 — 더블클릭하면 펼쳐집니다`}>
              {n}
            </span>
          )}
        </span>
      );
    },
  }),
  h.accessor('progress',     { header: '진행',       size: 78,  cell: txt }),
  h.accessor('project_name', { header: '프로젝트명', size: 320, cell: txt, meta: { cellPopup: true } }),
  // 팀·파트 — 기본 표시(2026-10-02 요청). 프로젝트명과 담당자 사이
  h.accessor('team',         { header: '팀',           size: 172, cell: txt }),
  // 파트 앞 원문자(①~⑦)는 차트·필터 칩 등에선 stripPartPrefix로 이미 떼고 보여주는데
  // 이 표만 원본 그대로 노출하고 있었음 — 여기선 번호가 필요 없다는 피드백으로 통일(2026-09-21)
  h.accessor('part',         { header: '파트',         size: 128,
    cell: i => <HighlightText text={stripPartPrefix(String(i.getValue() ?? ''))} query={i.table.options.meta?.searchQuery} /> }),
  h.accessor('manager',      { header: '담당자',     size: 78,  cell: txt }),
  h.accessor('plan_initial',      { header: '사업계획 매출', size: 104, enableSorting: true, cell: i => eok(i), meta: eokMeta }),
  // 원가행의 최초사업계획(V열) — 백엔드가 매출행 줄에 붙여 줌
  h.accessor('plan_cost',         { header: '사업계획 원가', size: 104, enableSorting: true, cell: i => eok(i), meta: eokMeta }),
  h.accessor('jun_check_total',   { header: '당월 추정 매출', size: 112, enableSorting: true, cell: i => eok(i),
    meta: { ...eokMeta, cellFlag: finFlag('jun_check_total'), cellGlow: finCompare ? finGlow : undefined } }),
  // 재무 대조 모드에서만 — 재무 이력(완료 단계) 값, 천원 단위로 내려옴(백엔드 _attach_finance_mismatch)
  ...(finCompare ? [h.accessor('fin_jun_check_total', { header: '재무 이력 매출(완료)', size: 132, cell: i => eok(i),
    meta: { ...eokMeta, cellGlow: finGlow } })] : []),
  // 원가행 BH / 매출행 BH − 원가행 BH(엑셀 AR17 − AR18) — 백엔드가 원가행에서 직접 읽어 줌(2026-10-02 사용자 정의)
  h.accessor('est_cost',          { header: '당월 추정 직접원가', size: 136, enableSorting: true, cell: i => eok(i),
    meta: { ...eokMeta, cellFlag: finFlag('est_cost'), cellGlow: finCompare ? finGlow : undefined } }),
  ...(finCompare ? [h.accessor('fin_est_cost', { header: '재무 이력 직접원가(완료)', size: 160, cell: i => eok(i),
    meta: { ...eokMeta, cellGlow: finGlow } })] : []),
  h.accessor('est_gross',         { header: '매출 이익', size: 96, enableSorting: true, cell: i => eok(i), meta: eokMeta }),
  h.accessor('cost_labor',        { header: '인건비',   size: 76, cell: i => eok(i), meta: eokMeta }),
  h.accessor('cost_overhead',     { header: '공통원가', size: 84, cell: i => eok(i), meta: eokMeta }),
  h.accessor('cost_mgmt',         { header: '관리비',   size: 76, cell: i => eok(i), meta: eokMeta }),
  // 경상손익·손익률은 강조 음영(emphasisCol, 2026-10-02 요청)
  h.accessor('operating_profit',  { header: '경상손익', size: 84, enableSorting: true, cell: i => eok(i), meta: { ...eokMeta, emphasisCol: true } }),
  h.accessor('profit_rate',       { header: '손익률',   size: 76, enableSorting: true, meta: { emphasisCol: true },
    cell: i => i.getValue() ? formatPercent(i.getValue() as number, i.table.options.meta?.rawValues) : '-' }),

  // ── 기본 숨김 (컬럼 메뉴에서 체크하면 표시) ──
  // 아래 주석 처리된 컬럼은 2026-10-02 요청으로 표·컬럼 메뉴에서 모두 뺌(되살리려면 주석만 풀면 됨 — (매출)/(원가) 나누기는 SPLIT_FIELDS가 그대로 처리)
  // 매출행 BB·BA 원본 — 기본 컬럼(원가행 BH 기준)과 값은 같음. 대조용으로만 남김
  // h.accessor('cost_direct',       { header: '직접원가(BB)', size: 104, cell: i => eok(i), meta: eokMeta }),
  // h.accessor('profit_gross',      { header: '매출이익(BA)', size: 104, cell: i => eok(i), meta: eokMeta }),
  // h.accessor('plan_diff_amount',  { header: '계획 대비 추정 실적 차이 금액', size: 180, cell: i => eok(i), meta: eokMeta }),
  h.accessor('plan_diff_rate',    { header: '증감률', size: 76, cell: pct }),
  h.accessor('chk_cost_rate',   { header: '원가율', size: 78, cell: i => pct(i) }),
  h.accessor('chk_course',      { header: '과정',   size: 66, cell: i => num(i.getValue()) }),
  h.accessor('chk_session',     { header: '차수',   size: 66, cell: i => num(i.getValue()) }),
  h.accessor('chk_participant', { header: '인원',   size: 66, cell: i => num(i.getValue()) }),
  h.accessor('change_note',     { header: '변동 검토의견', size: 240, cell: txt, meta: { cellPopup: true } }),
  // h.accessor('tech_category',{ header: '미래기술분류', size: 148, cell: txt }),
  // h.accessor('biz_type',     { header: '사업구분',     size: 116, cell: txt }),
  // h.accessor('customer_type',{ header: '고객구분',     size: 136, cell: txt }),
  // h.accessor('biz_plan',     { header: '사업계획',     size: 88,  cell: txt }),
  // h.accessor('edu_type',     { header: '교육형태',     size: 128, cell: txt }),
  // h.accessor('biz_type2',    { header: '사업유형',     size: 116, cell: txt }),
  // h.accessor('budget_code',  { header: '예산코드',     size: 116, cell: txt }),
  // h.accessor('actual_2025',       { header: '25년 실적',  size: 84, enableSorting: true, cell: i => eok(i), meta: eokMeta }),
  // h.accessor('plan_cost_rate',    { header: '계획원가율', size: 80, cell: i => pct(i) }),
  // h.accessor('course_count',      { header: '계획과정',   size: 74, cell: i => num(i.getValue()) }),
  // h.accessor('session_count',     { header: '계획차수',   size: 74, cell: i => num(i.getValue()) }),
  // h.accessor('participant_count', { header: '계획인원',   size: 74, cell: i => num(i.getValue()) }),
  // h.accessor('jun_est',        { header: `${_PERF_MONTH} 추정`,   size: 84, cell: i => eok(i), meta: eokMeta }),
  // h.accessor('jun_est_rate',   { header: `${PERF_MONTH} 추정율`, size: 80, cell: i => pct(i) }),
  // h.accessor('jun_actual',     { header: `${PERF_MONTH} 실적`,   size: 84, enableSorting: true, cell: i => eok(i), meta: eokMeta }),
  // h.accessor('jun_cost_rate',  { header: `${PERF_MONTH} 원가율`, size: 80, cell: i => pct(i) }),
  // h.accessor('cost_rate_diff', { header: '원가율 차이', size: 84, cell: i => pct(i).replace(/%$/, '%p') }),
  // h.accessor('est_vs_actual',  { header: '추정 대비',   size: 84, cell: i => eok(i), meta: eokMeta }),
  // h.accessor('cost_rate_reason',{ header: '원가율 사유', size: 200, cell: txt, meta: { cellPopup: true } }),
  // h.accessor('plan_diff_reason', { header: '사유',     size: 180, cell: txt, meta: { cellPopup: true } }),
  // h.accessor('balance_amount', { header: '대차금액', size: 84,  cell: i => eok(i), meta: eokMeta }),
  // h.accessor('balance_rate',   { header: '대차비율', size: 76,  cell: pct }),
  // h.accessor('dup_check',      { header: '중복점검', size: 200, cell: txt, meta: { cellPopup: true } }),
  // h.accessor('ref_code',       { header: '참조코드', size: 220, cell: txt, meta: { cellPopup: true } }),
  // 신사업 직접원가
  // h.accessor('sa_direct_total',    { header: '직접원가 소계', cell: i => num(i.getValue()) }),
  // h.accessor('sa_instructor',      { header: '강사비',        cell: i => num(i.getValue()) }),
  // h.accessor('sa_sub_instructor',  { header: '보조강사비',    cell: i => num(i.getValue()) }),
  // h.accessor('sa_venue',           { header: '강의장',        cell: i => num(i.getValue()) }),
  // h.accessor('sa_practice',        { header: '실습비',        cell: i => num(i.getValue()) }),
  // h.accessor('sa_textbook',        { header: '교재비',        cell: i => num(i.getValue()) }),
  // h.accessor('sa_other_direct',    { header: '기타직접',      cell: i => num(i.getValue()) }),
  // 신사업 공통원가
  // h.accessor('sa_overhead_total',  { header: '공통원가 소계', cell: i => num(i.getValue()) }),
  // h.accessor('sa_refreshment',     { header: '다과비',        cell: i => num(i.getValue()) }),
  // h.accessor('sa_edu_venue',       { header: '교육장',        cell: i => num(i.getValue()) }),
  // h.accessor('sa_parking',         { header: '주차비',        cell: i => num(i.getValue()) }),
  // h.accessor('sa_sw_practice',     { header: '실습비SW',      cell: i => num(i.getValue()) }),
  // h.accessor('sa_intern',          { header: '인턴인건비',    cell: i => num(i.getValue()) }),
  // 인건비
  // h.accessor('sa_labor_total',     { header: '인건비 소계', cell: i => num(i.getValue()) }),
  // h.accessor('sa_regular',         { header: '정규직',      cell: i => num(i.getValue()) }),
  // h.accessor('sa_overhead_cost',   { header: '제경비',      cell: i => num(i.getValue()) }),
  // 기타
  // h.accessor('note',        { header: '비고', size: 280, cell: txt, meta: { cellPopup: true } }),
  // h.accessor('filename',    { header: '원본파일명', size: 300, cell: txt, meta: { cellPopup: true } }),
];

/**
 * 매출행·원가행 값이 다른 필드 — "(매출)" / "(원가)" 두 컬럼으로 나눔(2026-10-02 요청, 한 줄로 합치며 헷갈리지 않게).
 * 원가 쪽 값은 백엔드가 `cost__<필드>`로 내려줌(performance.py PERF_COST_SIDE_FIELDS와 같은 목록 —
 * 사업계획·당월 추정 매출은 위 전용 컬럼(사업계획 원가·당월 추정 직접원가)이 이미 있어 제외).
 * 과정·차수·인원·계획 대비 추정 실적 차이 금액은 무조건 매출행 기준이라 나누지 않음(2026-10-02 요청)
 */
const SPLIT_FIELDS = new Set([
  'actual_2025', 'budget_code', 'biz_type2',
  'jun_est', 'jun_actual', 'est_vs_actual', 'cost_rate_reason',
  'plan_diff_rate', 'plan_diff_reason', 'change_note',
  'balance_amount', 'balance_rate', 'dup_check', 'ref_code',
  'sa_direct_total', 'sa_instructor', 'sa_sub_instructor', 'sa_venue', 'sa_practice', 'sa_textbook',
  'sa_other_direct', 'sa_overhead_total', 'sa_refreshment', 'sa_edu_venue', 'sa_parking',
  'sa_sw_practice', 'sa_intern', 'sa_labor_total', 'sa_regular', 'sa_overhead_cost', 'note',
]);

/** SPLIT_FIELDS 컬럼을 (매출)·(원가) 두 개로 펼침 — 셀 렌더·폭·meta는 그대로 복사 */
const splitRevCost = (cols: ReturnType<typeof buildColumns>) =>
  cols.flatMap(c => {
    const key = (c as { accessorKey?: string }).accessorKey;
    if (!key || !SPLIT_FIELDS.has(key)) return [c];
    const header = String((c as { header?: unknown }).header ?? key);
    return [
      { ...c, header: `${header}(매출)` },
      { ...c, accessorKey: `cost__${key}`, header: `${header}(원가)` },
    ] as typeof cols;
  });

/** 기본 표시 컬럼 — 이 목록에 없는 컬럼은 전부 기본 숨김(컬럼 메뉴에서 체크하면 표시) */
export const PERF_VISIBLE: string[] = [
  'project_code', 'progress', 'project_name', 'team', 'part', 'manager',
  'plan_initial', 'plan_cost', 'jun_check_total', 'fin_jun_check_total', 'est_cost', 'fin_est_cost', 'est_gross',
  'cost_labor', 'cost_overhead', 'cost_mgmt', 'operating_profit', 'profit_rate',
];

const _visibleSet = new Set(PERF_VISIBLE);

const _colId = (c: unknown) => (c as { accessorKey: string }).accessorKey;

export interface PerfColumnSet {
  columns:       ReturnType<typeof splitRevCost>;
  /** DataTable initialColumnVisibility 용 — 기본 숨김 컬럼을 false로 */
  defaultHidden: Record<string, boolean>;
  /** 숨김/표시 토글 가능한 컬럼 — 컬럼 정의에서 자동 파생(프로젝트코드는 항상 표시) */
  hideable:      HideableColumn[];
}

// 기준월·재무 대조 모드별로 한 번만 만듦 — 같은 조합이면 같은 참조라 표가 컬럼을 다시 계산하지 않음
const _cache = new Map<string, PerfColumnSet>();
export const perfColumnSet = (month: string, finCompare = false): PerfColumnSet => {
  const cacheKey = `${month}|${finCompare}`;
  const hit = _cache.get(cacheKey);
  if (hit) return hit;
  const columns = splitRevCost(buildColumns(month, finCompare));
  const set: PerfColumnSet = {
    columns,
    defaultHidden: Object.fromEntries(columns.map(_colId).filter(id => !_visibleSet.has(id)).map(id => [id, false])),
    hideable: columns
      .map(c => ({ id: _colId(c), label: String((c as { header?: unknown }).header ?? '') }))
      .filter(c => c.id !== 'project_code'),
  };
  _cache.set(cacheKey, set);
  return set;
};
