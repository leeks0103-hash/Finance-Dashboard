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
