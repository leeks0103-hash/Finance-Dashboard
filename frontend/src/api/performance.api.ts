import client from './client';
import type { PerfSummary, PerfProject, PerfOptions } from '@/types/performance.types';
import type { PagedResponse, PageParams } from '@/types/finance.types';

const toParams = (parts: string[]): URLSearchParams => {
  const p = new URLSearchParams();
  parts.forEach(v => p.append('part', v));
  return p;
};

export const getPerfSummary = (parts: string[]): Promise<PerfSummary> =>
  client.get<PerfSummary>('/performance/summary', { params: toParams(parts) }).then(r => r.data);

export const getPerfData = (
  parts: string[],
  page: PageParams,
): Promise<PagedResponse<PerfProject>> => {
  const params = toParams(parts);
  params.set('page',      String(page.page));
  params.set('page_size', String(page.pageSize));
  if (page.search) params.set('search', page.search);
  return client.get<PagedResponse<PerfProject>>('/performance/data', { params }).then(r => r.data);
};

export const getPerfOptions = (): Promise<PerfOptions> =>
  client.get<PerfOptions>('/performance/options').then(r => r.data);

export const reloadPerfData = () =>
  client.post('/performance/reload').then(r => r.data);
