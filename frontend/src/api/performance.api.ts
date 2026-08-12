import client from './client';
import { appendPageParams } from './queryParams';
import type { PerfSummary, PerfProject, PerfOptions } from '@/types/performance.types';
import type { PagedResponse, PageParams } from '@/types/finance.types';

const toParams = (parts: string[], team = ''): URLSearchParams => {
  const p = new URLSearchParams();
  parts.forEach(v => p.append('part', v));
  if (team) p.set('team', team);
  return p;
};

export const getPerfSummary = (parts: string[], team = ''): Promise<PerfSummary> =>
  client.get<PerfSummary>('/performance/summary', { params: toParams(parts, team) }).then(r => r.data);

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
