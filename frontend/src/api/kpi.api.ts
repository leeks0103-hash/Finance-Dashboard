import client from './client';
import { buildFilterParams, appendPageParams } from './queryParams';
import type { KpiSummary, KpiRawRow } from '@/types/kpi.types';
import type { PagedResponse, PageParams, Filters } from '@/types/finance.types';

export interface KpiOptions {
  years:  string[];
  parts:  string[];
  stages: string[];
}

export const getKpiSummary = (part = ''): Promise<KpiSummary> =>
  client.get<KpiSummary>('/kpi/summary', { params: part ? { part } : undefined }).then(r => r.data);

export const getKpiOptions = (): Promise<KpiOptions> =>
  client.get<KpiOptions>('/kpi/options').then(r => r.data);

export const getKpiData = (
  filters: Filters,
  page: PageParams,
  anomalyOnly = false,
): Promise<PagedResponse<KpiRawRow>> => {
  const params = buildFilterParams(filters);
  appendPageParams(params, page);
  if (anomalyOnly) params.set('anomaly_only', '1');
  return client.get<PagedResponse<KpiRawRow>>('/kpi/data', { params }).then(r => r.data);
};

export const reloadKpiData = () =>
  client.post('/kpi/reload').then(r => r.data);

export interface OpenFileResult {
  ok:       boolean;
  message?: string;
}

/** 파일명으로 원본 PPT 위치를 찾아 서버(로컬 PC)에서 직접 실행 — NAS 이전 전 로컬 경로 기준 */
export const openKpiFile = (filename: string): Promise<OpenFileResult> =>
  client.post<OpenFileResult>('/kpi/open-file', { filename }).then(r => r.data);

// ── KPI 집계 막대 드릴다운 (어떤 행들을 합/평균했는지) ──
export interface KpiBreakdownRow {
  project_code: string;
  project_name: string;
  part:  string;
  stage: string;
  file:  string;
  value: number;
}

export interface KpiBreakdown {
  available:      boolean;
  message?:       string;
  name?:          string;
  metric?:        'target' | 'actual' | 'prev';
  metric_label?:  string;
  agg?:           'sum' | 'avg';
  column?:        string;
  rows?:          KpiBreakdownRow[];
  count?:         number;
  total?:         number;
  is_count_type?: boolean;
  sub?:           string | null;
  note?:          string;
}

export const getKpiBreakdown = (
  name: string,
  metric: 'target' | 'actual' | 'prev',
): Promise<KpiBreakdown> =>
  client.get<KpiBreakdown>('/kpi/summary/breakdown', { params: { name, metric } }).then(r => r.data);
