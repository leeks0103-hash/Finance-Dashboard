import client from './client';
import { appendPageParams } from './queryParams';
import type { PerfSummary, PerfProject, PerfOptions, PerfInsights, FinMismatchRow } from '@/types/performance.types';
import type { PagedResponse, PageParams } from '@/types/finance.types';

const toParams = (parts: string[], team = ''): URLSearchParams => {
  const p = new URLSearchParams();
  parts.forEach(v => p.append('part', v));
  if (team) p.set('team', team);
  return p;
};

export const getPerfSummary = (parts: string[], team = ''): Promise<PerfSummary> =>
  client.get<PerfSummary>('/performance/summary', { params: toParams(parts, team) }).then(r => r.data);

export const getPerfInsights = (parts: string[], team = ''): Promise<PerfInsights> =>
  client.get<PerfInsights>('/performance/insights', { params: toParams(parts, team) }).then(r => r.data);

export const getPerfData = (
  parts: string[],
  page: PageParams,
  team = '',
  progress = '',
): Promise<PagedResponse<PerfProject>> => {
  const params = toParams(parts, team);
  if (progress) params.set('progress', progress);
  appendPageParams(params, page);
  return client.get<PagedResponse<PerfProject>>('/performance/data', { params }).then(r => r.data);
};

export const getPerfOptions = (): Promise<PerfOptions> =>
  client.get<PerfOptions>('/performance/options').then(r => r.data);

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
