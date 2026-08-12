import client from './client';
import { buildFilterParams, appendPageParams } from './queryParams';
import type { KpiSummary, KpiRawRow } from '@/types/kpi.types';
import type { PagedResponse, PageParams, Filters } from '@/types/finance.types';

export interface KpiOptions {
  years:  string[];
  parts:  string[];
  stages: string[];
}

export const getKpiSummary = (): Promise<KpiSummary> =>
  client.get<KpiSummary>('/kpi/summary').then(r => r.data);

export const getKpiOptions = (): Promise<KpiOptions> =>
  client.get<KpiOptions>('/kpi/options').then(r => r.data);

export const getKpiData = (
  filters: Filters,
  page: PageParams,
): Promise<PagedResponse<KpiRawRow>> => {
  const params = buildFilterParams(filters);
  appendPageParams(params, page);
  return client.get<PagedResponse<KpiRawRow>>('/kpi/data', { params }).then(r => r.data);
};

export const reloadKpiData = () =>
  client.post('/kpi/reload').then(r => r.data);
