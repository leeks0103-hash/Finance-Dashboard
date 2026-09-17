import client from './client';

export interface DataHealthRow {
  file: string;
  finance_codes: string[];
  kpi_codes: string[];
}

/**
 * 서로 다른 PPT가 같은 (코드/연도/단계) 키를 공유해서 한쪽이 덮어써진 경우.
 * 덮어써진 파일은 취합 시트에 자기 이름으로 된 행이 아예 안 남아서 위 rows(파일명 기준
 * 재무↔KPI 비교)로는 절대 안 잡힘 — 추출 시점에 기록된 걸 따로 받아온다
 */
export interface DataHealthConflict {
  source: string;    // '재무' | 'KPI'
  code:   string;
  /** 이 코드를 공유하는 PPT 파일들 (2개 이상) */
  files:  string[];
}

export interface DataHealthResponse {
  count: number;
  rows: DataHealthRow[];
  conflicts: DataHealthConflict[];
}

/** KPI ↔ 재무 데이터가 같은 파일에서 서로 다른 프로젝트코드를 뽑아낸 경우 + 코드 충돌 목록 */
export const getDataHealth = (): Promise<DataHealthResponse> =>
  client.get<DataHealthResponse>('/data-health').then(r => r.data);
