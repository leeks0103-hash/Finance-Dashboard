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

// finance.api.ts의 OpenFileResult와 구조가 같아 재사용해도 되지만, api/index.ts에서
// export *로 재수출할 때 동일 이름 충돌(TS2308)이 나서 여긴 모듈 내부 전용으로 둔다
interface KpiOpenFileResult {
  ok:       boolean;
  message?: string;
}

/** 파일명으로 원본 PPT 위치를 찾아 서버(로컬 PC)에서 직접 실행.
 *  실패(404 못 찾음 · 409 이미 열려있음)도 axios가 던지는 예외가 아니라
 *  { ok:false, message } 형태로 정상 resolve — 호출부가 항상 .then(r => r.ok)만 보면 되게 */
export const openKpiFile = (filename: string): Promise<KpiOpenFileResult> =>
  client.post<KpiOpenFileResult>('/kpi/open-file', { filename })
    .then(r => r.data)
    .catch((err): KpiOpenFileResult => err?.response?.data ?? { ok: false, message: '파일을 열 수 없습니다.' });

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
