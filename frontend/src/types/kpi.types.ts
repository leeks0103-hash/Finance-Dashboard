export interface KpiSummaryItem {
  name:         string;
  agg:          'sum' | 'avg';
  target_2026:  number;
  actual_2026:  number;
  achieve_rate: number | null;
}

export interface KpiSummary {
  available: boolean;
  message?:  string;
  items?:    KpiSummaryItem[];
}

// 취합 시트 — 컬럼이 동적이므로 Record 사용
export type KpiRawRow = Record<string, string | number | null>;
