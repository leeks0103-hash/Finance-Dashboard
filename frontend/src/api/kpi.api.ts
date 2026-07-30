import client from './client';
import type { KpiSummary, KpiRawRow } from '@/types/kpi.types';
import type { PagedResponse, PageParams } from '@/types/finance.types';

export const getKpiSummary = (): Promise<KpiSummary> =>
  client.get<KpiSummary>('/kpi/summary').then(r => r.data);

export const getKpiData = (page: PageParams): Promise<PagedResponse<KpiRawRow>> => {
  const params = new URLSearchParams();
  params.set('page',      String(page.page));
  params.set('page_size', String(page.pageSize));
  if (page.search) params.set('search', page.search);
  return client.get<PagedResponse<KpiRawRow>>('/kpi/data', { params }).then(r => r.data);
};

export const reloadKpiData = () =>
  client.post('/kpi/reload').then(r => r.data);
