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
  // by_part 전용 — by_stage는 채워지지 않음
  direct_cost?: number;
  labor_cost?: number;
  overhead?: number;
}

export interface CostBreakdown {
  direct_cost: number;
  labor_cost: number;
  overhead: number;
}

export interface Summary {
  total_revenue: number;
  total_expenditure: number;
  total_profit: number;
  avg_profit_rate: number;
  count: number;
  by_part: Record<string, PartStats>;
  by_stage?: Record<string, PartStats>;
  cost_breakdown: CostBreakdown;
  loaded_at?: string | null;
}

export type CommentType = 'positive' | 'info' | 'neutral' | 'warning';

export interface Comment {
  type: CommentType;
  icon: string;
  text: string;
  /** 특정 프로젝트를 가리키는 코멘트만 존재 — 있으면 프로젝트명 클릭 가능 (실적 인사이트에서 사용) */
  project_code?: string;
  project_name?: string;
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

/** 재무/실적현황 인사이트 순위 리스트 한 행 — InsightSectionView 공용 표시 단위 */
export interface InsightRow {
  key:         string;
  displayCode: string;
  part:        string;
  value:       string;
  valueColor?: string;
  subValue?:   string;
}

export interface InsightListSpec {
  variant: 'profit' | 'risk' | 'default';
  title:   string;
  rows:    InsightRow[];
  /** 제공 시 기본 카드(테두리 박스) + ProjectRankRow 목록 대신 이 렌더러로 전체 바디를 그림 (예: 테이블) */
  renderList?: (rows: InsightRow[], onCodeSearch: (code: string) => void) => import('react').ReactNode;
  /** true면 카드 박스 없이 "주요 코멘트"와 동일한 평면 타이틀 스타일로 렌더 */
  plain?: boolean;
}

// M-6: discriminated union — TypeScript가 ok:true/false 분기를 타입 안전하게 처리
export type ReloadResponse =
  | { ok: true;  loaded_at: string; count: number; corrected_rows: number }
  | { ok: false; error: string };

export interface PagedResponse<T> {
  data:  T[];
  total: number;
}

export interface PageParams {
  page:     number;
  pageSize: number;
  search:   string;
  /** 검색 대상 컬럼 — 미지정("") 시 기존처럼 전체 컬럼 대상 검색 */
  field?:   string;
}
