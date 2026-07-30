import client from './client';
import type { PerfSummary, PerfProject, PerfOptions } from '@/types/performance.types';

const toParams = (parts: string[]): URLSearchParams => {
  const p = new URLSearchParams();
  parts.forEach(v => p.append('part', v));
  return p;
};

export const getPerfSummary = (parts: string[]): Promise<PerfSummary> =>
  client.get<PerfSummary>('/performance/summary', { params: toParams(parts) }).then(r => r.data);

export const getPerfData = (parts: string[]): Promise<PerfProject[]> =>
  client.get<PerfProject[]>('/performance/data', { params: toParams(parts) }).then(r => r.data);

export const getPerfOptions = (): Promise<PerfOptions> =>
  client.get<PerfOptions>('/performance/options').then(r => r.data);

export const reloadPerfData = () =>
  client.post('/performance/reload').then(r => r.data);
