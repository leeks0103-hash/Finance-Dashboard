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
  /** 사업계획 원가 — 원가행의 최초사업계획(V열). 백엔드가 매출행 줄에 붙여 줌(프로젝트당 한 줄) */
  plan_cost?:        number | null;
  /** 당월 추정 직접원가 = 원가행 BH (천원). 백엔드 계산 */
  est_cost?:         number | null;
  /** 매출 이익 = 매출행 BH − 원가행 BH (천원, 엑셀 AR17 − AR18). 백엔드 계산 */
  est_gross?:        number | null;
  /** 원가행 값 — 매출행과 값이 다른 필드만(백엔드 PERF_COST_SIDE_FIELDS). 표에서 "(원가)" 컬럼 */
  [costField: `cost__${string}`]: unknown;
  /** 진행 '완료' 줄에서 재무 이력(완료 단계)과 값이 다른 필드 — 'jun_check_total'(매출) / 'est_cost'(원가) */
  fin_mismatch?:     string[];
  /** 재무 이력 완료 단계 값(천원) — 툴팁용 */
  fin_jun_check_total?: number | null;
  fin_est_cost?:        number | null;
  /** 완료 줄 — 당월 추정 직접원가가 재무 이력 착수 단계 직접원가보다 크거나 같음(1,000원 미만 차이는 같음) */
  fin_cost_over_start?: boolean | null;
  /** 재무 이력 착수 단계 직접원가(천원) — 착수 보고가 있고 0보다 클 때만 */
  fin_start_est_cost?:  number | null;
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
  _group_no:         number;   // 프로젝트(줄) 일련번호 — 전체 기준, 페이지 넘어가도 연속
}

export interface PerfPartStats {
  plan_initial:     number;
  /** 계획 원가 */
  plan_cost:        number;
  cost_direct:      number;
  cost_labor:       number;
  cost_overhead:    number;
  cost_mgmt:        number;
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
  /** 추정 대비 누계 진행률(%) = 누계매출 ÷ 연간 추정매출 × 100. 백엔드 계산(파트별 매출 진행 현황) */
  est_progress_rate?: number;
  // ── 인당 값(2026-10-23) — 파트 인원은 관리자 수기 입력(data/headcount.json). 천원, 인원 미입력·부분이면 null ──
  /** 관리자가 입력한 파트 현재 인원. 미입력이면 null */
  headcount?:         number | null;
  // /** 관리자가 입력한 파트 계획 인원. 미입력이면 null */   // 계획 인원 주석 처리(2026-10-27)
  // plan_headcount?:    number | null;
  /** 팀 필터로 행이 잘린 다팀 파트(K뉴딜TF) — 인당 값을 못 구함 */
  headcount_partial?: boolean;
  // /** 인당 계획 매출 = 계획 매출 ÷ 계획 인원 */   // 주석 처리(2026-10-27)
  // rev_per_head_plan?: number | null;
  /** 인당 추정 매출 = 연간 추정 매출 ÷ 현재 인원 */
  rev_per_head_est?:  number | null;
  /** 인당 추정 경상손익 = 연간 경상손익 ÷ 인원 (계획 손익은 원본에 없음) */
  profit_per_head?:   number | null;
  /** 인당 추정 관리비 = 연간 관리비 ÷ 인원 (계획 관리비는 원본에 없음) */
  mgmt_per_head?:     number | null;
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
  plan_gross:       number;
  /** 연간 추정 매출이익 = 추정매출 − 추정원가 (천원) */
  est_gross:        number;
  /** 계획 칸에 쓴 공통원가(천원) — 시트 합계 블록의 사업계획 기준 값, 못 읽거나 필터 중이면 추정 공통원가 */
  plan_overhead?:   number;
  /** 'sheet' = 사업계획 기준 값(정확), 'estimate' = 추정 공통원가로 대체(Flask 재시작 전엔 필드 없음) */
  plan_overhead_source?: 'sheet' | 'estimate';
  /** 계획 관리비(천원) — 시트 합계 블록의 사업계획 기준. 팀·파트 필터 중이거나 못 읽으면 null(Flask 재시작 전엔 필드 없음) */
  plan_mgmt?:             number | null;
  /** 계획 경상손익(천원) — 같은 블록의 '손익' 줄. 없으면 null */
  plan_operating_profit?: number | null;
  /** 계획 인건비(천원) — 같은 블록의 '인건비' 줄. 없으면 null */
  plan_labor?:            number | null;
  /** 카드별 계획 대비 추정(%) = 추정 ÷ 계획 × 100 — 카드 id(revenue·cost·overhead·grossProfit·labor·mgmt·profit) → 값(계획 없음·0 이하면 null). Flask 재시작 전엔 필드 없음 */
  est_plan_rate?:         Record<string, number | null>;
  /** 계획 대비 누계 진행률(%) = 누계매출 ÷ 계획매출 × 100. 계획 0 이하면 null */
  achieve_rate?:    number | null;
  /** 추정 대비 누계 진행률(%) = 누계매출 ÷ 연간 추정매출 × 100. 추정 0 이하면 null */
  est_progress_rate?: number | null;
  /** 원가 진행률(%) = 누계원가 ÷ 연간 추정원가 × 100. 추정 0 이하면 null */
  est_cost_progress_rate?: number | null;
  /** 관리비 ÷ 연간 추정 매출 × 100(매출행 BE ÷ BH) — 관리비 카드 보조값, 백엔드 계산 */
  est_mgmt_rate?: number | null;
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
  /** 팀별 원가 구성·경상손익 — 행의 팀 칸 기준(도넛 팀 보기, 2026-10-21). 옛 서버엔 없음 */
  by_team?:    Record<string, { cost_direct: number; cost_labor: number; cost_overhead: number; cost_mgmt: number; operating_profit: number }>;
  by_progress: Record<string, PerfProgressStats>;
  monthly:     PerfMonthly[];
  loaded_at?:  string | null;
  /** 실제로 읽은 시트의 기준 연·월(예: "2026년 (8월 집계)" → { year: 2026, month: 8 }). 옛 서버엔 없음 */
  base?:       { year: number; month: number } | null;
}

export interface PerfOptions {
  parts: string[];
  teams: string[];
  /** 팀 → 그 팀 소속 파트 목록 (원문, 접두어 포함) */
  team_parts: Record<string, string[]>;
  /** 진행단계 — 값 종류가 적고 고정적(제안/착수/완료/드롭 등)이라 프로젝트 상세 표에서
   *  자유 검색 대신 셀렉트박스로 필터링할 때 씀 */
  progress: string[];
  /** 담당자 목록 — 프로젝트 상세 열 필터(2026-10-14). 옛 서버는 없음 */
  managers?: string[];
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

/** 완료 프로젝트 재무 대조 불일치 — 관리자 기능 목록(/api/performance/fin-mismatch). 금액은 원 */
export interface FinMismatchRow {
  project_code: string;
  project_name: string;
  team: string;
  part: string;
  manager: string;
  /** 재무 이력(완료 보고) PPT 파일명 */
  fin_filename: string;
  perf_revenue: number | null;
  fin_revenue: number | null;
  revenue_diff: number | null;
  revenue_mismatch: boolean;
  perf_cost: number | null;
  fin_cost: number | null;
  cost_diff: number | null;
  cost_mismatch: boolean;
}

/** 실적현황 파일 자동 반영 상태 — 서버 data/perf_update_status.json(관리자 페이지, 2026-10-14) */
export interface PerfUpdateCheck { name: string; rate: number; ok: boolean }
export interface PerfUpdateStatus {
  /** 마지막으로 확인한 파일(최신 파일)과 결과 */
  file?:       string;
  sheet?:      string;
  checked_at?: string;
  ok?:         boolean;
  /** 열 매핑 방법 — 기존 매핑 / 자동 정렬(기준: …) / + H-chat 보완 */
  method?:     string;
  changes?:    string[];
  checks?:     PerfUpdateCheck[];
  /** 억원(프로젝트 수는 건) */
  totals?:     Record<string, number>;
  /** H-chat 요약(자동 정렬한 경우만) */
  summary?:    string;
  error?:      string;
  /** 지금 대시보드가 보여주는 파일·시트 — 최신이 실패하면 직전 파일 */
  serving?:       string;
  serving_sheet?: string;
  /** data/의 실적 파일(최신 먼저) */
  files:       string[];
  loaded_at?:  string | null;
  /** 올리기 결과 안내 — 같은 파일이 이미 있음 / 같은 이름 이전 파일을 히스토리로 옮김 */
  notice?:     string;
  /** 2027 사업계획 시트(계획 뷰)의 반영 상태 — 같은 모양, 최상위는 실적 뷰(2026-10-29). 그 파일에 계획 시트가 없으면 없음 */
  plan27?:     Omit<PerfUpdateStatus, 'files' | 'plan27' | 'notice'>;
}


// ── 2027 사업계획 보기(계획 뷰, 2026-10-29) ─────────────────────────────────
// 실적 요약(PerfSummary)과 필드를 공유하지 않는 별도 응답 — 기준월·누계·달성률이 없음. 금액은 전부 천원.
export type PerfView = 'actual' | 'plan27';

/** 전환 가능한 뷰 — plan27.available=false(계획 시트가 없음)면 전환 칩을 숨김 */
export interface PerfViews {
  actual: { available: boolean; sheet?: string | null; base?: { year: number; month: number } | null };
  plan27: { available: boolean; sheet?: string | null; year?: number | null };
}

/** 한 시점(26 추정 또는 27 계획)의 합계. null = 값 없음('-') — 26 추정의 공통원가·인건비·관리비·경상손익은
 *  시트 합계 블록에서 읽어 팀·파트 필터 중이거나 못 읽으면 null */
export interface PerfPlanValues {
  revenue:  number;
  cost:     number;
  overhead: number | null;
  labor:    number | null;
  mgmt:     number | null;
  profit:   number | null;
  /** 매출 − (직접원가 + 공통원가) */
  gross:    number | null;
}

export interface PerfPlanPartStats {
  rev26: number; rev27: number; cost26: number; cost27: number;
  /** 27 계획 매출 ÷ 26 추정 매출 × 100 — 26이 0 이하면 null */
  rev_rate: number | null;
  cost_direct: number; cost_labor: number; cost_overhead: number; cost_mgmt: number;
  operating_profit: number; avg_profit_rate: number; count: number;
  /** 원가율(%) = 원가(직접+공통) ÷ 27 계획 매출 — 백엔드 계산, 매출이 0 이하면 null */
  cost_rate?: number | null;
  /** 27 계획 매출 대비 구성 비율(%) — 구성 막대 칸 수치 옆에 표시(백엔드 계산) */
  comp_rate?: { direct: number | null; labor: number | null; overhead: number | null; mgmt: number | null; profit: number | null };
  /** 파트 인원(관리자 수기 입력 — 실적 보기의 "현재 인원"과 같은 값). 미입력이면 null */
  headcount?: number | null;
  /** 팀 필터로 행이 잘린 상태에서 여러 팀에 걸친 파트 — 인당 값을 못 구함 */
  headcount_partial?: boolean;
  /** 27 계획 금액 ÷ 인원(천원). 인원이 없거나 headcount_partial이면 null */
  rev_per_head?: number | null;
  profit_per_head?: number | null;
  mgmt_per_head?: number | null;
}

export interface PerfPlanTotal {
  y26: PerfPlanValues;
  y27: PerfPlanValues;
  /** 카드 id(revenue·cost·overhead·grossProfit·labor·mgmt·profit) → 27 계획 ÷ 26 추정 × 100 (없으면 null) */
  rate: Record<string, number | null>;
  cost_direct: number; cost_labor: number; cost_overhead: number; cost_mgmt: number;
  operating_profit: number; avg_profit_rate: number; count: number;
  /** 원가율(%) — cost_rate = 원가(직접+공통) ÷ 매출(구성 차트), direct_rate = 직접원가 ÷ 매출(월별 차트의 원가율). 백엔드 계산 */
  cost_rate?: number | null;
  direct_rate?: number | null;
}

export interface PerfPlanSummary {
  view:      'plan27';
  year?:     number | null;
  sheet?:    string | null;
  loaded_at?: string | null;
  /** 데이터가 없으면 빈 객체({}) — y27이 없으면 비어 있는 것 */
  total: Partial<PerfPlanTotal>;
  by_part: Record<string, PerfPlanPartStats>;
  by_team: Record<string, { cost_direct: number; cost_labor: number; cost_overhead: number; cost_mgmt: number; operating_profit: number; cost_rate?: number | null }>;
  /** 1~12월 계획 분배(실적 아님) */
  monthly: PerfMonthly[];
}
