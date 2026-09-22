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
  /** 자동 분류 — 'needs_review'(진짜 확인 필요) | 'likely_same_project'(한 파일에 여러
   *  프로젝트가 있고 배치 보고서 제목만 단계마다 바뀐 것으로 추정, 오탐 가능성 높음) */
  verdict?: 'needs_review' | 'likely_same_project';
  /** verdict 판단 근거 (예: "파트·매출 금액이 파일 간 일관됨") */
  reason?:  string;
}

/**
 * "완료" 단계 보고서인데 매출·직접원가 외(지출/인건비/공통원가/경상이익/이익율) 값이
 * 들어있는 파일 — 그 항목들은 완료 PPT 양식상 원래 비어있어야 함(담당자 정책, 2026-09-21).
 * PPT가 아직 안 고쳐졌거나 오입력일 가능성이 높아 확인 대상.
 */
export interface DataHealthFinishedAnomaly {
  project_code: string;
  part:         string;
  filename:     string;
  /** 채워져 있으면 안 되는데 값이 들어간 필드들 */
  fields: { label: string; value: number }[];
}

export interface DataHealthResponse {
  count: number;
  rows: DataHealthRow[];
  conflicts: DataHealthConflict[];
  finished_anomalies: DataHealthFinishedAnomaly[];
}

/** KPI ↔ 재무 데이터가 같은 파일에서 서로 다른 프로젝트코드를 뽑아낸 경우 + 코드 충돌 목록 */
export const getDataHealth = (): Promise<DataHealthResponse> =>
  client.get<DataHealthResponse>('/data-health').then(r => r.data);
