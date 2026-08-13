// 단위: 천원 (백엔드에서 그대로 반환)

export interface PerfProject {
  // 식별
  tech_category:     string;
  team:              string;
  part:              string;
  biz_division:      string;
  biz_type:          string;
  customer_type:     string;
  biz_plan:          string;
  progress:          string;
  category:          string;
  edu_type:          string;
  budget_code:       string;
  project_code:      string;
  biz_type2:         string;
  budget_unit:       string;
  project_name:      string;
  manager:           string;
  // 재무
  actual_2025:       number;
  plan_initial:      number;
  plan_cost_rate:    number;
  course_count:      number;
  session_count:     number;
  participant_count: number;
  // 6월 기준 실적 집계 현황
  jun_est:           number;
  jun_est_rate:      number;
  jun_actual:        number;
  jun_cost_rate:     number;
  cost_rate_diff:    number;
  est_vs_actual:     number;
  cost_rate_reason:  string;
  plan_diff_amount:  number;
  plan_diff_rate:    number;
  plan_diff_reason:  string;
  // 손익 점검
  profit_gross:      number;
  cost_direct:       number;
  cost_labor:        number;
  cost_overhead:     number;
  cost_mgmt:         number;
  operating_profit:  number;
  profit_rate_raw:   number;
  profit_rate:       number;  // % 변환 완료
  // 6월 점검
  jun_check_total:   number;
  chk_m01: number; chk_m02: number; chk_m03: number; chk_m04: number;
  chk_m05: number; chk_m06: number; chk_m07: number; chk_m08: number;
  chk_m09: number; chk_m10: number; chk_m11: number; chk_m12: number;
  chk_cost_rate:     number;
  chk_course:        number;
  chk_session:       number;
  chk_participant:   number;
  change_note:       string;
  // 대차
  balance_amount:    number;
  balance_rate:      number;
  // 참조
  dup_check:         string;
  ref_code:          string;
  // 신사업파트 직접원가
  sa_direct_total:   number;
  sa_instructor:     number;
  sa_sub_instructor: number;
  sa_venue:          number;
  sa_practice:       number;
  sa_textbook:       number;
  sa_other_direct:   number;
  // 신사업파트 공통원가
  sa_overhead_total: number;
  sa_refreshment:    number;
  sa_edu_venue:      number;
  sa_parking:        number;
  sa_sw_practice:    number;
  sa_intern:         number;
  // 인건비
  sa_labor_total:    number;
  sa_regular:        number;
  sa_overhead_cost:  number;
  // 기타
  note:              string;
  filename:          string;
  _row_num:          number;   // 고유 key 용 행 번호
}

export interface PerfPartStats {
  plan_initial:     number;
  jun_actual:       number;
  jun_cost:         number;
  jun_check_total:  number;
  operating_profit: number;
  avg_profit_rate:  number;
  count:            number;
}

export interface PerfTotal {
  plan_initial:     number;
  actual_2025:      number;
  jun_actual:       number;
  jun_cost:         number;
  jun_check_total:  number;
  operating_profit: number;
  profit_gross:     number;
  cost_direct:      number;
  cost_labor:       number;
  cost_overhead:    number;
  cost_mgmt:        number;
  avg_profit_rate:  number;
  count:            number;
}

export interface PerfMonthly {
  month:   string;
  revenue: number;
  cost:    number;
}

export interface PerfSummary {
  total:   PerfTotal;
  by_part: Record<string, PerfPartStats>;
  monthly: PerfMonthly[];
}

export interface PerfOptions {
  parts: string[];
  teams: string[];
}

export interface PerfWorstRow {
  project_code:  string;
  part:          string;
  project_name:  string;
  plan_initial:  number;
  jun_actual:    number;
  achieve_rate:  number;
}

export interface PerfRiskRow {
  project_code:      string;
  part:              string;
  project_name:      string;
  operating_profit:  number;
  profit_rate:       number;
}

export interface PerfComment {
  type: 'positive' | 'info' | 'neutral' | 'warning';
  icon: string;
  text: string;
}

export interface PerfInsights {
  worst:    PerfWorstRow[];
  risk:     PerfRiskRow[];
  comments: PerfComment[];
}
