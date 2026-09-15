import client from './client';

export interface DataHealthRow {
  file: string;
  finance_codes: string[];
  kpi_codes: string[];
}

export interface DataHealthResponse {
  count: number;
  rows: DataHealthRow[];
}

/** KPI ↔ 재무 데이터가 같은 파일에서 서로 다른 프로젝트코드를 뽑아낸 경우 목록 */
export const getDataHealth = (): Promise<DataHealthResponse> =>
  client.get<DataHealthResponse>('/data-health').then(r => r.data);
