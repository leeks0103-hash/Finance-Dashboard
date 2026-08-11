import client from './client';
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
  const params = new URLSearchParams();
  filters.years.forEach(v  => params.append('year',  v));
  filters.parts.forEach(v  => params.append('part',  v));
  filters.stages.forEach(v => params.append('stage', v));
  params.set('page',      String(page.page));
  params.set('page_size', String(page.pageSize));
  if (page.search) params.set('search', page.search);
  return client.get<PagedResponse<KpiRawRow>>('/kpi/data', { params }).then(r => r.data);
};

export const reloadKpiData = () =>
  client.post('/kpi/reload').then(r => r.data);
