export interface KpiSummaryItem {
  name:         string;
  agg:          'sum' | 'avg';
  target_2026:  number;
  actual_2026:  number;
  prev_actual:  number;   // 25년 실적 (PJ유사 컬럼 집계)
  achieve_rate: number | null;
  /** 26년 목표(사업계획) — 담당자 지정 고정값. 백엔드 _PLAN_TARGETS에서 주입, 없으면 "-" */
  plan_target:  string;
}

/** 조기입력 의심 한 건 = 프로젝트(파일·코드·보고단계) 하나 — 지표가 여럿 채워져 있어도 한 건(2026-11-11) */
export interface KpiAnomaly {
  /** 예외 처리 대상 식별자(서버가 만듦) */
  id:           string;
  project_code: string;
  stage:        string;
  file:         string;
  metrics:      { metric: string; value: string }[];
}

/** 관리자가 예외 처리한 건 — 관리자 응답에만 있음 */
export interface KpiAnomalyExcepted extends KpiAnomaly {
  by: string;
  at: string;
}

export interface KpiSummary {
  available:      boolean;
  message?:       string;
  items?:         KpiSummaryItem[];
  /** 보고단계가 완료 전인데 실적이 이미 채워진 프로젝트 — 조기입력 의심 (kpi.py _find_premature_actual_rows). 예외 처리한 건은 빠짐 */
  anomaly_count?: number;
  anomalies?:     KpiAnomaly[];
  /** 관리자가 예외 처리한 건(관리자에게만 옴) — 해제할 자리용 */
  excepted?:      KpiAnomalyExcepted[];
}

// 취합 시트 — 컬럼이 동적이므로 Record 사용
export type KpiRawRow = Record<string, string | number | null>;
