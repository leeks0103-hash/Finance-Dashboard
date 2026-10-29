import client from './client';
import { appendPageParams } from './queryParams';
import { getStoredExtractKey, authHeaders } from './extract.api';
import type {
  PerfSummary, PerfProject, PerfOptions, PerfInsights, FinMismatchRow, PerfUpdateStatus,
  PerfView, PerfViews, PerfPlanSummary,
} from '@/types/performance.types';
import type { PagedResponse, PageParams } from '@/types/finance.types';
import type { ColumnFilterValue } from '@/types/columnFilter.types';

/** view는 계획 보기(plan27)일 때만 주소에 붙임 — 실적 요청은 예전과 똑같은 주소 */
const toParams = (parts: string[], team = '', view: PerfView = 'actual'): URLSearchParams => {
  const p = new URLSearchParams();
  parts.forEach(v => p.append('part', v));
  if (team) p.set('team', team);
  if (view !== 'actual') p.set('view', view);
  return p;
};

export const getPerfSummary = (parts: string[], team = ''): Promise<PerfSummary> =>
  client.get<PerfSummary>('/performance/summary', { params: toParams(parts, team) }).then(r => r.data);

/** 2027 사업계획 보기 요약 — 27 계획 vs 26 추정(기준월·누계·달성률 없음) */
export const getPerfPlanSummary = (parts: string[], team = ''): Promise<PerfPlanSummary> =>
  client.get<PerfPlanSummary>('/performance/summary', { params: toParams(parts, team, 'plan27') }).then(r => r.data);

/** 전환 가능한 뷰(2026 실적 / 2027 계획) — 계획 시트가 없으면 plan27.available=false */
export const getPerfViews = (): Promise<PerfViews> =>
  client.get<PerfViews>('/performance/views').then(r => r.data);

export const getPerfInsights = (parts: string[], team = ''): Promise<PerfInsights> =>
  client.get<PerfInsights>('/performance/insights', { params: toParams(parts, team) }).then(r => r.data);

export const getPerfData = (
  parts: string[],
  page: PageParams,
  team = '',
  progress = '',
  columnFilters: ColumnFilterValue[] = [],
  view: PerfView = 'actual',
): Promise<PagedResponse<PerfProject>> => {
  const params = toParams(parts, team, view);
  if (progress) params.set('progress', progress);
  if (columnFilters.length) params.set('cf', JSON.stringify(columnFilters));
  appendPageParams(params, page);
  return client.get<PagedResponse<PerfProject>>('/performance/data', { params }).then(r => r.data);
};

/** 프로젝트 상세 엑셀 다운로드 주소 — 표와 같은 필터·검색·정렬(페이지는 무시, 전체). <a href>라 토큰은 ?token= */
export const perfExportHref = (
  parts: string[], page: PageParams, team = '', progress = '', columnFilters: ColumnFilterValue[] = [],
  view: PerfView = 'actual',
): string => {
  const params = toParams(parts, team, view);
  if (progress) params.set('progress', progress);
  if (columnFilters.length) params.set('cf', JSON.stringify(columnFilters));
  appendPageParams(params, page);
  params.delete('page'); params.delete('page_size');
  const token = getStoredExtractKey();
  if (token) params.set('token', token);
  return `/api/performance/data/export?${params.toString()}`;
};

export const getPerfOptions = (view: PerfView = 'actual'): Promise<PerfOptions> =>
  client.get<PerfOptions>('/performance/options', { params: view === 'actual' ? undefined : { view } }).then(r => r.data);

export const reloadPerfData = () =>
  client.post('/performance/reload').then(r => r.data);

// ── 실적현황 차트 막대 드릴다운 (어떤 프로젝트 행들을 합산했는지) ──
export type PerfBreakdownChart =
  | 'monthly' | 'planVsActual' | 'profitRate' | 'costBreakdown' | 'partAchievement';

export interface PerfBreakdownRow {
  project_code: string;
  project_name: string;
  part:  string;
  team:  string;
  value: number;   // 억
}

export interface PerfCalcTerm {
  term:    string;
  formula: string;
  note:    string;
}

export interface PerfBreakdownCompareRow {
  project_code: string;
  project_name: string;
  part:  string;
  team:  string;
  plan:  number;   // 억
  actual: number;  // 억
  /** actual÷plan×100 — 계획이 0이면 비교 불가(null) */
  rate:  number | null;
}

/** pair=True인 차트(planVsActual·partAchievement)에서 클릭한 시리즈와 무관하게 함께 오는
 *  계획·실적 나란히 비교 데이터 — "이 막대=계획만/실적만"이 아니라 프로젝트별 달성률까지 보여줌 */
export interface PerfBreakdownCompare {
  plan_label:        string;
  actual_label:       string;
  plan_field_desc:    string;
  actual_field_desc:  string;
  rows:        PerfBreakdownCompareRow[];
  plan_total:  number;
  actual_total: number;
  rate:        number | null;
}

export interface PerfBreakdown {
  available:     boolean;
  message?:      string;
  chart?:        PerfBreakdownChart;
  series_label?: string;
  dim?:          'month' | 'part' | 'none';
  key?:          string;
  /** 이 막대가 어떤 엑셀 열을 쓰는지 */
  field_desc?:   string;
  /** 어떻게 집계했는지(합/평균 등) */
  agg_desc?:     string;
  /** 파생 값(매출이익·경상손익 등) 계산식 — 모달 '용어' 영역 */
  glossary?:     PerfCalcTerm[];
  rows?:         PerfBreakdownRow[];
  count?:        number;
  total?:        number;
  unit?:         string;
  compare?:      PerfBreakdownCompare;
}

export const getPerfBreakdown = (
  chart: PerfBreakdownChart,
  series: number,
  key: string,
  parts: string[],
  team = '',
): Promise<PerfBreakdown> => {
  const params = toParams(parts, team);
  params.set('chart', chart);
  params.set('series', String(series));
  params.set('key', key);
  return client.get<PerfBreakdown>('/performance/summary/breakdown', { params }).then(r => r.data);
};

/** 완료 프로젝트 재무 불일치 목록 — 관리자 전용, 필터 무관 전체 */
export const getPerfFinMismatch = (): Promise<{ data: FinMismatchRow[]; total: number }> =>
  client.get<{ data: FinMismatchRow[]; total: number }>('/performance/fin-mismatch').then(r => r.data);

// ── 실적현황 파일 자동 반영(관리자) — 2026-10-14 ──
export const getPerfUpdateStatus = (): Promise<PerfUpdateStatus> =>
  client.get<PerfUpdateStatus>('/performance/update-status', { headers: authHeaders(), timeout: 180_000 }).then(r => r.data);

export const retryPerfUpdate = (): Promise<PerfUpdateStatus> =>
  client.post<PerfUpdateStatus>('/performance/update-status/retry', null, { headers: authHeaders(), timeout: 180_000 }).then(r => r.data);

/** data/에 넣고 바로 반영 시도 — 오래 걸릴 수 있음(H-chat 포함) */
export const uploadPerfFile = (file: File): Promise<PerfUpdateStatus> => {
  const form = new FormData();
  form.append('file', file);
  // client 기본 Content-Type이 JSON이라 그대로 두면 axios가 FormData를 JSON으로 바꿔 보냄 → multipart로 덮어씀(경계값은 axios가 붙임)
  return client.post<PerfUpdateStatus>('/performance/upload', form,
    { headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' }, timeout: 180_000 })
    .then(r => r.data);
};
