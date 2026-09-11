import client from './client';
import { appendPageParams } from './queryParams';
import type { PerfSummary, PerfProject, PerfOptions, PerfInsights } from '@/types/performance.types';
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
): Promise<PagedResponse<PerfProject>> => {
  const params = toParams(parts, team);
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
