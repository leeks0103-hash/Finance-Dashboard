import client from './client';
import { buildFilterParams, appendPageParams } from './queryParams';
import type { Filters, Summary, Insights, Project, ReloadResponse, PagedResponse, PageParams } from '../types/finance.types';

export const getSummary = (filters: Filters): Promise<Summary> =>
  client.get<Summary>('/summary', { params: buildFilterParams(filters) }).then(r => r.data);

export const getInsights = (filters: Filters): Promise<Insights> =>
  client.get<Insights>('/insights', { params: buildFilterParams(filters) }).then(r => r.data);

export const getProjects = (
  filters: Filters,
  page: PageParams,
): Promise<PagedResponse<Project>> => {
  const params = buildFilterParams(filters);
  appendPageParams(params, page);
  return client.get<PagedResponse<Project>>('/data', { params }).then(r => r.data);
};

export const reloadData = (): Promise<ReloadResponse> =>
  client.post<ReloadResponse>('/reload').then(r => r.data);

export const getPdfUrl = (filters: Filters): string =>
  `/api/export/pdf?${buildFilterParams(filters).toString()}`;

/** 재무 PPT 이력이 있는 프로젝트코드 → 건수. 실적현황 표의 2뎁스 보유 배지용 */
export const getFinanceCodes = (): Promise<Record<string, number>> =>
  client.get<{ codes: Record<string, number> }>('/finance/codes').then(r => r.data.codes);

export interface OpenFileResult {
  ok:       boolean;
  message?: string;
}

/** 파일명으로 원본 PPT 위치를 찾아 서버(로컬 PC)에서 직접 실행 — NAS 이전 전 로컬 경로 기준 */
export const openFinanceFile = (filename: string): Promise<OpenFileResult> =>
  client.post<OpenFileResult>('/finance/open-file', { filename }).then(r => r.data);

// ── 재무 차트 막대/조각 드릴다운 (어떤 프로젝트 행들을 합산했는지) ──
export interface FinanceBreakdownRow {
  project_code: string;
  filename:     string;
  part:         string;
  stage:        string;
  value:        number;
}

export interface FinanceBreakdown {
  available: boolean;
  message?:  string;
  label?:    string;
  unit?:     string;
  dim?:      string;
  key?:      string;
  rows?:     FinanceBreakdownRow[];
  count?:    number;
  total?:    number;
}

export const getFinanceBreakdown = (
  filters: Filters,
  field: string,
  dim: 'part' | 'stage' | '',
  key: string,
): Promise<FinanceBreakdown> => {
  const params = buildFilterParams(filters);
  params.set('field', field);
  if (dim) params.set('dim', dim);
  if (key) params.set('key', key);
  return client.get<FinanceBreakdown>('/summary/breakdown', { params }).then(r => r.data);
};
