import client from './client';
import type { Filters, Summary, Insights, Project, ReloadResponse, PagedResponse, PageParams } from '../types/finance.types';

const toParams = (f: Filters): URLSearchParams => {
  const p = new URLSearchParams();
  if (f.year) p.set('year', f.year);
  f.parts.forEach(v => p.append('part', v));
  f.stages.forEach(v => p.append('stage', v));
  return p;
};

export const getSummary = (filters: Filters): Promise<Summary> =>
  client.get<Summary>('/summary', { params: toParams(filters) }).then(r => r.data);

export const getInsights = (filters: Filters): Promise<Insights> =>
  client.get<Insights>('/insights', { params: toParams(filters) }).then(r => r.data);

export const getProjects = (
  filters: Filters,
  page: PageParams,
): Promise<PagedResponse<Project>> => {
  const params = toParams(filters);
  params.set('page',      String(page.page));
  params.set('page_size', String(page.pageSize));
  if (page.search) params.set('search', page.search);
  return client.get<PagedResponse<Project>>('/data', { params }).then(r => r.data);
};

export const reloadData = (): Promise<ReloadResponse> =>
  client.post<ReloadResponse>('/reload').then(r => r.data);

export const getPdfUrl = (filters: Filters): string =>
  `/api/export/pdf?${toParams(filters).toString()}`;
