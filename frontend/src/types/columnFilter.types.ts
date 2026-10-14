/** 표 머리글 열 필터(2026-10-14) — 컬럼 정의(ColumnMeta.filter)에 어떤 필터를 쓸지 */
export type ColumnFilterSpec =
  | { type: 'text' }
  /** 고르기 목록 — 값 목록은 table meta.filterOptions[열 id]에서 */
  | { type: 'select' }
  /** 이상/이하 — eok는 억 단위로 입력(서버가 천원으로 바꿈), pct는 % 그대로 */
  | { type: 'number'; unit: 'eok' | 'pct' };

/** 걸린 필터 한 개 — 서버 apply_column_filters가 받는 모양 그대로(JSON) */
export type ColumnFilterValue =
  | { id: string; type: 'text'; q: string }
  | { id: string; type: 'select'; values: string[] }
  | { id: string; type: 'number'; unit: 'eok' | 'pct'; min: number | null; max: number | null };
