import client from './client';
import type { KpiSummary, KpiRawRow } from '@/types/kpi.types';

export const getKpiSummary = (): Promise<KpiSummary> =>
  client.get<KpiSummary>('/kpi/summary').then(r => r.data);

export const getKpiData = (): Promise<KpiRawRow[]> =>
  client.get<KpiRawRow[]>('/kpi/data').then(r => r.data);

export const reloadKpiData = () =>
  client.post('/kpi/reload').then(r => r.data);
