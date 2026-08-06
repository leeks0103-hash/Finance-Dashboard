export type KpiAccent = 'brand' | 'profit' | 'loss' | 'warn' | 'purple';

export interface Filters {
  years: string[];
  parts: string[];
  stages: string[];
}

export interface Project {
  _row_num:     number;
  project_code: string;
  year: string;
  part: string;
  stage: string;
  revenue: number;
  expenditure: number;
  direct_cost: number;
  labor_cost: number;
  overhead: number;
  operating_profit: number;
  profit_rate: number;
  note: string;
  filename: string;
  processed_at: string;
  reflected_at: string;
}

export interface PartStats {
  revenue: number;
  expenditure: number;
  profit: number;
  count: number;
}

export interface CostBreakdown {
  direct_cost: number;
  labor_cost: number;
  overhead: number;
}

export interface YearStats {
  revenue: number;
  expenditure: number;
  profit: number;
  count: number;
  avg_profit_rate?: number;
}

export interface Summary {
  total_revenue: number;
  total_expenditure: number;
  total_profit: number;
  avg_profit_rate: number;
  count: number;
  by_part: Record<string, PartStats>;
  by_year?: Record<string, YearStats>;
  by_stage?: Record<string, PartStats>;
  cost_breakdown: CostBreakdown;
}

export type CommentType = 'positive' | 'info' | 'neutral' | 'warning';

export interface Comment {
  type: CommentType;
  icon: string;
  text: string;
}

export interface ProjectRow {
  project_code: string;
  part: string;
  stage: string;
  revenue: number;
  operating_profit: number;
  profit_rate: number;
}

export interface Insights {
  top: ProjectRow[];
  risk: ProjectRow[];
  comments: Comment[];
}

// M-6: discriminated union — TypeScript가 ok:true/false 분기를 타입 안전하게 처리
export type ReloadResponse =
  | { ok: true;  loaded_at: string; count: number }
  | { ok: false; error: string };

export interface PagedResponse<T> {
  data:  T[];
  total: number;
}

export interface PageParams {
  page:     number;
  pageSize: number;
  search:   string;
}
