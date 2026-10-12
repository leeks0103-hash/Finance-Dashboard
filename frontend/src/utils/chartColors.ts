/**
 * 재무·KPI·실적현황 3탭 전체가 공유하는 차트 색상 팔레트.
 * 지표별 의미를 색으로 고정해 탭을 넘나들어도 같은 지표는 같은 색으로 보이게 한다.
 *
 * 현대자동차 브랜드 지정 9색 팔레트 기반 (Sky Blue는 도넛 세그먼트 한정, 텍스트엔 미사용).
 * 브랜드 지정값이라 대비 검증보다 팔레트 준수 우선.
 *   revenue      — 매출·실적 (Hyundai Blue)
 *   cost         — 지출·원가 (Hyundai Gold)
 *   profit       — 이익 절대금액 (Hyundai Blue — 파랑=플러스, 증시 반대 개념)
 *   loss         — 손실·마이너스 (Active Red — 빨강=마이너스)
 *   rate         — 이익율(%) 등 비율 지표 (Hyundai Blue — profit과 동일 계열)
 *   costDirect   — 원가구성 도넛: 직접원가 (Hyundai Blue — cost/Gold와 분리, 갈색 계열 폐기)
 *   costLabor    — 원가구성 도넛: 인건비 (Active Blue)
 *   costOverhead — 원가구성 도넛: 공통원가 (Sky Blue에 검정 30% 섞은 톤 — 원색은 너무 연해서)
 *   costMgmt     — 원가구성 도넛: 관리비 (Hyundai Gold — 파랑 3톤과 구분되는 유일한 브랜드색)
 *   plan         — 계획·목표 등 비교 기준선 계열 (Sand/블루그레이 중립 — 실적 계열과 겹치지 않게). 계획 막대는 이 색으로 통일
 *   planLabel    — 계획 막대 위 수치 글자색 (plan을 불투명·진하게 — 반투명 plan 그대로면 글자가 흐려서, 막대색은 유지)
 *   planRevenue  — "파트별 추정 매출/원가" 확대 모달 전용 매출 계획선 (매출과 같은 파랑 계열, 밝기만 다르게)
 *   planCost     — 같은 모달 전용 원가 계획선 (원가와 같은 Gold 계열, 라이트=훨씬 진하게 / 다크=훨씬 밝게)
 *                  — 막대와 완전히 같은 색이면 계획 < 실적인 파트에서 선이 막대 안에 묻혀 안 보임.
 *                    대조 대상을 색 계열로 알아보면서 막대 위에서도 구분되게 하려는 이 차트만의 예외
 */
export interface ChartPalette {
  revenue:      string;
  cost:         string;
  profit:       string;
  loss:         string;
  rate:         string;
  costDirect:   string;
  costLabor:    string;
  costOverhead: string;
  costMgmt:     string;
  plan:         string;
  planLabel:    string;
  planRevenue:  string;
  planCost:     string;
}

/** 데이터 시리즈 색과 별개로, 축 눈금·격자선·데이터라벨 텍스트에 쓰는 차트 "크롬" 색 — 3탭 공용 */
export interface ChartTheme {
  labelColor: string;
  gridColor:  string;
  tickColor:  string;
  /** 카드 배경(--surface)과 같은 색 — 수치 라벨 뒤에 깔아 선·막대가 글자를 관통하지 않게 가릴 때 */
  surfaceColor: string;
}

export const getChartTheme = (dark: boolean): ChartTheme => dark ? {
  labelColor: 'rgba(228,220,211,0.95)',  /* Hyundai Sand */
  gridColor:  'rgba(60,90,120,0.45)',    /* Blue-tinted grid */
  tickColor:  'rgba(228,220,211,0.90)',  /* Hyundai Sand */
  surfaceColor: '#0E2038',               /* index.css 다크 --surface */
} : {
  labelColor: '#002C5F',                 /* Hyundai Blue */
  gridColor:  'rgba(0,44,95,0.08)',      /* Hyundai Blue 연하게 */
  tickColor:  '#002C5F',                 /* Hyundai Blue */
  surfaceColor: '#FFFFFF',               /* index.css 라이트 --surface */
};

// fadeAlpha(PerformanceChartSection)가 마지막 숫자를 정규식으로 치환하는 방식이라
// rgba(...) 형식(알파 1) 유지 — 순수 hex로 바꾸면 미래월 페이드 효과가 조용히 깨짐
//
// 현대자동차 브랜드 9색 기반 (증시 반대 개념 — 플러스=파랑, 마이너스=빨강):
//   revenue/profit/rate/costDirect = Hyundai Blue · loss = Active Red · cost = Hyundai Gold
//   costLabor = Active Blue · costOverhead = Sky Blue 어둡게 · costMgmt = Hyundai Gold
const basePalette = (dark: boolean): ChartPalette => dark ? {
  revenue:      'rgba(77,166,214,1)',   /* Hyundai Blue tint — 다크 가독성 */
  cost:         'rgba(199,148,113,1)',  /* Hyundai Gold tint */
  profit:       'rgba(77,166,214,1)',   /* Hyundai Blue tint — 플러스 */
  loss:         'rgba(255,106,77,1)',   /* Active Red tint — 마이너스 */
  rate:         'rgba(77,166,214,1)',   /* Hyundai Blue tint — profit과 동일 */
  costDirect:   'rgba(77,166,214,1)',   /* Hyundai Blue tint — 갈색(Gold) 폐기 */
  costLabor:    'rgba(0,170,210,1)',    /* Active Blue */
  costOverhead: 'rgba(119,141,161,1)',  /* Sky Blue에 검정 30% — 원래 Sky Blue는 흰 배경에서 너무 연했음(2026-09-29) */
  costMgmt:     'rgba(199,148,113,1)',  /* Hyundai Gold tint */
  plan:         'rgba(159,179,196,0.55)', /* 블루그레이 중립 — 계획·목표 */
  planLabel:    'rgba(159,179,196,1)',  /* plan 불투명 — 수치 글자용 */
  planRevenue:  'rgba(170,202,230,1)',  /* Sky Blue — revenue tint보다 밝게 */
  planCost:     'rgba(245,225,205,1)',  /* Hyundai Gold 아주 밝은 파생 — cost tint(중간 밝기)와 밝기 차 크게 */
} : {
  revenue:      'rgba(0,44,95,1)',      /* Hyundai Blue */
  cost:         'rgba(163,107,79,1)',   /* Hyundai Gold */
  profit:       'rgba(0,44,95,1)',      /* Hyundai Blue — 플러스 */
  loss:         'rgba(230,51,18,1)',    /* Active Red — 마이너스 */
  rate:         'rgba(0,44,95,1)',      /* Hyundai Blue — profit과 동일 */
  costDirect:   'rgba(0,44,95,1)',      /* Hyundai Blue — 갈색(Gold) 폐기 */
  costLabor:    'rgba(0,170,210,1)',    /* Active Blue */
  costOverhead: 'rgba(119,141,161,1)',  /* Sky Blue에 검정 30% — 원래 Sky Blue는 흰 배경에서 너무 연했음(2026-09-29) */
  costMgmt:     'rgba(163,107,79,1)',   /* Hyundai Gold */
  plan:         'rgba(107,98,87,0.45)',  /* Sand 계열 중립 — 계획·목표 */
  planLabel:    'rgba(132,129,125,1)',  /* plan의 흰 배경 실효색(188,184,179)에 검정 30% — 수치 글자가 흐리다는 피드백(2026-09-29) */
  planRevenue:  'rgba(0,170,210,1)',    /* Active Blue — Hyundai Blue 막대 위에서도 보이게 */
  planCost:     'rgba(92,54,34,1)',     /* Hyundai Gold 진한 파생 — Gold 막대보다 확실히 어둡게(밝은 톤은 막대와 구분 안 됨) */
};

// ── 사용자 지정 차트 색(2026-10-08) ─────────────────────────────────────────────
// ⚙ 설정 > 차트 색상에서 역할(매출·원가·…)별로 덮어씀. 현대 9색·파생 톤 견본을 고르거나, 색 피커(react-colorful)로
// 아무 색(#hex)이나 넣을 수 있음. 다크 모드 색·계획선·계획 수치 글자색은 고른 색에서 자동 계산.
// 고르지 않은 역할은 위 basePalette(기본값) 그대로라 기본 화면은 예전과 똑같다
//
// 예외처리(자유 색 허용과 함께):
//   - 잘못된 값(깨진 localStorage, 없는 역할·견본, 형식이 틀린 hex)은 버리고 기본값 — sanitizeChartColors
//   - 배경과 거의 같은 색(대비 < MIN_VISIBLE)은 막대가 안 보이므로 그릴 때만 보이는 만큼 진하게/밝게 보정(저장값은 그대로)
//   - 다크 모드에선 직접 넣은 색이 남색 배경에 묻히면 자동으로 밝힘
//   - 같은 차트에 나오는 역할끼리 색이 같거나 너무 비슷하면 설정 화면에서 경고(막지는 않음)

type Rgb = readonly [number, number, number];

export type SwatchId = 'navy' | 'activeBlue' | 'skyDeep' | 'sky' | 'gold' | 'goldDeep' | 'red' | 'neutral';
/** 견본 ID 또는 사용자가 직접 넣은 색('#rrggbb', 소문자) */
export type ChartColorValue = SwatchId | `#${string}`;

/** 견본 — 라이트/다크 각각의 실제 색(다크는 남색 배경에서 보이게 밝힌 톤) */
export const CHART_SWATCHES: Record<SwatchId, { name: string; light: Rgb; dark: Rgb }> = {
  navy:       { name: 'Hyundai Blue',     light: [0, 44, 95],    dark: [77, 166, 214] },
  activeBlue: { name: 'Active Blue',      light: [0, 170, 210],  dark: [0, 170, 210] },
  skyDeep:    { name: 'Sky Blue (진하게)', light: [119, 141, 161], dark: [119, 141, 161] },
  sky:        { name: 'Sky Blue',         light: [170, 202, 230], dark: [170, 202, 230] },
  gold:       { name: 'Hyundai Gold',     light: [163, 107, 79], dark: [199, 148, 113] },
  goldDeep:   { name: 'Gold (진하게)',     light: [92, 54, 34],   dark: [214, 176, 146] },
  red:        { name: 'Active Red',       light: [230, 51, 18],  dark: [255, 106, 77] },
  neutral:    { name: 'Sand (회색)',       light: [107, 98, 87],  dark: [159, 179, 196] },
};
export const SWATCH_IDS = Object.keys(CHART_SWATCHES) as SwatchId[];

export type ColorRole =
  | 'revenue' | 'cost' | 'profit' | 'loss' | 'plan'
  | 'costDirect' | 'costLabor' | 'costOverhead' | 'costMgmt';

export type ChartColorOverrides = Partial<Record<ColorRole, ChartColorValue>>;

/** 설정 화면에 나열할 역할 — default는 basePalette와 같은 견본(설정 화면에서 "선택됨" 표시용) */
export const COLOR_ROLES: { role: ColorRole; label: string; desc: string; group: 'bar' | 'donut'; default: SwatchId }[] = [
  { role: 'revenue',      label: '매출·실적',   desc: '매출, 추정 실적, KPI 실적 막대',     group: 'bar',   default: 'navy' },
  { role: 'cost',         label: '원가·지출',   desc: '원가·지출 막대, KPI 사업계획 목표', group: 'bar',   default: 'gold' },
  { role: 'plan',         label: '계획·목표',   desc: '계획·목표 막대(반투명)',            group: 'bar',   default: 'neutral' },
  { role: 'profit',       label: '이익·이익율', desc: '재무 탭 이익액·이익율 막대',        group: 'bar',   default: 'navy' },
  { role: 'loss',         label: '손실',        desc: '손실 파트·마이너스 값',             group: 'bar',   default: 'red' },
  { role: 'costDirect',   label: '직접원가',    desc: '원가 비율 도넛',                    group: 'donut', default: 'navy' },
  { role: 'costLabor',    label: '인건비',      desc: '원가 비율 도넛',                    group: 'donut', default: 'activeBlue' },
  { role: 'costOverhead', label: '공통원가',    desc: '원가 비율 도넛',                    group: 'donut', default: 'skyDeep' },
  { role: 'costMgmt',     label: '관리비',      desc: '원가 비율 도넛',                    group: 'donut', default: 'gold' },
];
const ROLE_SET = new Set<string>(COLOR_ROLES.map(r => r.role));

/** 같은 차트에 함께 그려지는 역할 쌍 — 색이 (거의) 같으면 설정 화면에서 경고(막지는 않음).
 *  매출↔이익은 같은 차트에 안 나와서(이익액은 단독 토글) 기본값도 둘 다 Hyundai Blue */
const CO_SHOWN: [ColorRole, ColorRole][] = [
  ['revenue', 'cost'], ['revenue', 'plan'], ['revenue', 'loss'], ['cost', 'plan'], ['cost', 'loss'], ['profit', 'loss'],
  ['costDirect', 'costLabor'], ['costDirect', 'costOverhead'], ['costDirect', 'costMgmt'],
  ['costLabor', 'costOverhead'], ['costLabor', 'costMgmt'], ['costOverhead', 'costMgmt'],
];

// ── 색 계산 ──
const rgba = ([r, g, b]: Rgb, a = 1) => `rgba(${r},${g},${b},${a})`;
const mix = (c: Rgb, to: Rgb, t: number): Rgb =>
  [0, 1, 2].map(i => Math.round(c[i] + (to[i] - c[i]) * t)) as unknown as Rgb;
const lum = ([r, g, b]: Rgb) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
/** 차트 카드 배경(index.css --surface) — 라이트 흰색 / 다크 #0E2038 */
const SURFACE: Record<'light' | 'dark', Rgb> = { light: WHITE, dark: [14, 32, 56] };

/** WCAG 상대 휘도·대비 */
const relLum = (c: Rgb) => {
  const [r, g, b] = c.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrastRatio = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** 이 대비 미만이면 막대가 배경에 묻혀 사실상 안 보임 → 그릴 때 보정 */
const MIN_VISIBLE = 1.6;
/** 이 대비 미만이면 "연해서 잘 안 보일 수 있음" 경고(WCAG 그래픽 요소 기준 3:1) */
const MIN_COMFORT = 3;
/** 다크 모드 자동 밝힘 목표 — 직접 넣은 색이 남색 배경에 묻히지 않게 */
const DARK_TARGET = 3;

/** 배경과 대비가 target 이상이 될 때까지 배경 반대쪽(흰/검정)으로 조금씩 섞음 — 이미 충분하면 그대로 */
const ensureContrast = (c: Rgb, bg: Rgb, target: number): Rgb => {
  if (contrastRatio(c, bg) >= target) return c;
  const away = relLum(bg) > 0.5 ? BLACK : WHITE;
  for (let i = 1; i <= 20; i++) {
    const m = mix(c, away, i / 20);
    if (contrastRatio(m, bg) >= target) return m;
  }
  return away;
};

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
/** '#abc'·'#AABBCC'·'aabbcc' → '#aabbcc', 형식이 틀리면 null */
export const normalizeHex = (raw: unknown): `#${string}` | null => {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  const v = t.startsWith('#') ? t : `#${t}`;
  if (!HEX_RE.test(v)) return null;
  const h = v.slice(1).toLowerCase();
  return `#${h.length === 3 ? h.split('').map(ch => ch + ch).join('') : h}`;
};
const hexToRgb = (hex: string): Rgb =>
  [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;
const rgbToHex = (c: Rgb) => `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;

const isSwatchId = (v: unknown): v is SwatchId => typeof v === 'string' && Object.hasOwn(CHART_SWATCHES, v);
export const isCustomColor = (v: ChartColorValue): v is `#${string}` => v.startsWith('#');

/** 저장값 검증 — 모르는 역할·견본, 형식이 틀린 hex는 버림(깨진 localStorage 대비) */
export const sanitizeChartColors = (raw: unknown): ChartColorOverrides => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: ChartColorOverrides = {};
  for (const [role, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ROLE_SET.has(role)) continue;
    const val = isSwatchId(v) ? v : normalizeHex(v);
    if (val) out[role as ColorRole] = val;
  }
  return out;
};

/** 고른 값의 원래 색(배경 보정 전) — 견본은 테마별 색, 직접 넣은 색은 라이트 그대로·다크는 배경에 묻히면 밝힘 */
const rawRgb = (v: ChartColorValue, dark: boolean): Rgb => {
  if (isSwatchId(v)) return CHART_SWATCHES[v][dark ? 'dark' : 'light'];
  const c = hexToRgb(v);
  return dark ? ensureContrast(c, SURFACE.dark, DARK_TARGET) : c;
};
/** 실제로 그리는 색 — 배경에 묻히는 색은 보이는 만큼만 보정 */
const drawRgb = (v: ChartColorValue, dark: boolean): Rgb =>
  ensureContrast(rawRgb(v, dark), SURFACE[dark ? 'dark' : 'light'], MIN_VISIBLE);

export const swatchOf = (role: ColorRole, overrides: ChartColorOverrides): ChartColorValue =>
  overrides[role] ?? COLOR_ROLES.find(r => r.role === role)!.default;

/** 설정 화면 견본 표시용 — 지금 테마에서 실제로 그려질 색 */
export const swatchRgba = (v: ChartColorValue, dark: boolean) => rgba(drawRgb(v, dark));
/** 피커 초기값 — 지금 색의 라이트 hex */
export const valueToHex = (v: ChartColorValue) => (isSwatchId(v) ? rgbToHex(CHART_SWATCHES[v].light) : v);

/** 직접 넣은 색 안내 — 배경 대비가 낮으면 경고, 그릴 때 보정하면 그것도 알림 */
export const colorWarnings = (v: ChartColorValue): string[] => {
  if (!isCustomColor(v)) return [];
  const c = hexToRgb(v);
  const out: string[] = [];
  const light = contrastRatio(c, SURFACE.light);
  if (light < MIN_VISIBLE) out.push('흰 배경과 거의 같아 주간 모드에선 조금 진하게 그립니다');
  else if (light < MIN_COMFORT) out.push('주간 모드에서 연해서 잘 안 보일 수 있어요');
  if (contrastRatio(c, SURFACE.dark) < DARK_TARGET) out.push('야간 모드에선 배경에 묻히지 않게 밝게 그립니다');
  return out;
};

/** 눈으로 구분하기 어려울 만큼 가까운 색인지(가중 RGB 거리) — 견본끼리는 같은 견본일 때만 걸림 */
const tooSimilar = (a: Rgb, b: Rgb) => {
  const rm = (a[0] + b[0]) / 2;
  const [dr, dg, db] = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) < 60;
};

/** role과 같거나 너무 비슷한 색이 된(같은 차트에 함께 나오는) 다른 역할들 */
export const colorClashes = (role: ColorRole, overrides: ChartColorOverrides): ColorRole[] => {
  const mine = swatchOf(role, overrides);
  return CO_SHOWN.flatMap(([a, b]) => (a === role ? [b] : b === role ? [a] : []))
    .filter(other => {
      const theirs = swatchOf(other, overrides);
      return theirs === mine || tooSimilar(rawRgb(theirs, false), rawRgb(mine, false));
    });
};

/** 계획선 색 — 같은 계열이되 막대 위에서 보이게 밝기를 크게 벌림(어두운 색은 밝게, 밝은 색은 어둡게) */
const contrastShift = (c: Rgb): Rgb => (lum(c) < 0.5 ? mix(c, WHITE, 0.55) : mix(c, BLACK, 0.55));

export const getChartPalette = (dark: boolean, overrides: ChartColorOverrides = {}): ChartPalette => {
  const p = basePalette(dark);
  const safe = sanitizeChartColors(overrides);
  const pick = (role: ColorRole): Rgb | null => {
    const v = safe[role];
    return v ? drawRgb(v, dark) : null;
  };
  const revenue = pick('revenue');
  if (revenue) { p.revenue = rgba(revenue); p.planRevenue = rgba(contrastShift(revenue)); }
  const cost = pick('cost');
  if (cost) { p.cost = rgba(cost); p.planCost = rgba(contrastShift(cost)); }
  const profit = pick('profit');
  if (profit) { p.profit = rgba(profit); p.rate = rgba(profit); }
  const loss = pick('loss');
  if (loss) p.loss = rgba(loss);
  const plan = pick('plan');
  if (plan) {
    const alpha = dark ? 0.55 : 0.45;
    p.plan = rgba(plan, alpha);
    // 수치 글자: 라이트는 흰 배경 위 실효색에 검정 30%(기본값과 같은 방식), 다크는 불투명 그대로
    p.planLabel = rgba(dark ? plan : mix(mix(WHITE, plan, alpha), BLACK, 0.3));
  }
  for (const role of ['costDirect', 'costLabor', 'costOverhead', 'costMgmt'] as const) {
    const c = pick(role);
    if (c) p[role] = rgba(c);
  }
  return p;
};
