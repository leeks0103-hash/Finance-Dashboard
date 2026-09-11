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
  profit_rate:       number;  // % 변환 완료 (백엔드에서 profit_rate_raw * 100 후 drop)
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
  _group_no:         number;   // 묶음(프로젝트) 일련번호 — 전체 기준, 페이지 넘어가도 연속
}

export interface PerfPartStats {
  plan_initial:     number;
  /** 누계 매출 (1~기준월) */
  jun_actual:       number;
  /** 누계 원가 (1~기준월) */
  jun_cost:         number;
  /** 연간 추정 매출 */
  jun_check_total:  number;
  /** 연간 추정 원가 — jun_check_total(추정 매출)의 짝 */
  jun_cost_check:   number;
  /** 누계(1~기준월) 경상손익 — 누계매출/누계원가와 같은 기간. 엑셀에 없어 대시보드가 재구성 */
  acc_operating_profit: number;
  /** 누계 손익률(%) = 누계 경상손익 ÷ 누계매출 */
  acc_profit_rate:      number;
  operating_profit: number;
  avg_profit_rate:  number;
  count:            number;
  /** 누계 원가율(%) = 누계원가 ÷ 누계매출 × 100. 누계매출 0 이하면 null. 백엔드 계산 */
  cost_rate?:       number | null;
  /** 계획 대비 누계 진행률(%) = 누계매출 ÷ 계획매출 × 100. 백엔드 계산 */
  achieve_rate?:    number;
}

export interface PerfTotal {
  plan_initial:     number;
  plan_cost:        number;
  actual_2025:      number;
  jun_actual:       number;
  jun_cost_actual:  number;
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
  // ── 파생값 (백엔드 계산) ──────────────────────────────
  /** 계획 매출이익 = 계획매출 − 계획원가 (천원) */
  plan_gross?:      number;
  /** 연간 추정 매출이익 = 추정매출 − 추정원가 (천원) */
  est_gross?:       number;
  /** 계획 대비 누계 진행률(%) = 누계매출 ÷ 계획매출 × 100. 계획 0 이하면 null */
  achieve_rate?:    number | null;
  /** 전월대비 매출 diff (천원). 전월 데이터 없으면 null */
  mom_revenue?:     number | null;
  /** 전월대비 매출이익 diff (천원). 전월 데이터 없으면 null */
  mom_gross?:       number | null;
}

export interface PerfMonthly {
  month:   string;
  revenue: number;
  cost:    number;
}

export interface PerfProgressStats {
  revenue: number;
  cost:    number;
  profit:  number;
  count:   number;
}

export interface PerfSummary {
  total:       PerfTotal;
  by_part:     Record<string, PerfPartStats>;
  by_progress: Record<string, PerfProgressStats>;
  monthly:     PerfMonthly[];
  loaded_at?:  string | null;
}

export interface PerfOptions {
  parts: string[];
  teams: string[];
  /** 팀 → 그 팀 소속 파트 목록 (원문, 접두어 포함) */
  team_parts: Record<string, string[]>;
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
  /** 특정 프로젝트를 가리키는 코멘트만 존재 — 있으면 프로젝트명 클릭 가능 */
  project_code?: string;
  project_name?: string;
}

export interface PerfInsights {
  worst:    PerfWorstRow[];
  risk:     PerfRiskRow[];
  comments: PerfComment[];
}
