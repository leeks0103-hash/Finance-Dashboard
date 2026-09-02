/**
 * 재무·KPI·실적현황 3탭 전체가 공유하는 차트 색상 팔레트.
 * 지표별 의미를 색으로 고정해 탭을 넘나들어도 같은 지표는 같은 색으로 보이게 한다.
 *
 * dataviz 스킬의 사전 검증된 8색 카테고리 팔레트에서 6개를 골라 씀 — 색맹 대비(ΔE)·
 * 명도·채도·배경 대비를 scripts/validate_palette.js로 실측 통과한 값만 사용 (임의 조정 금지).
 *   revenue      — 매출·실적 (blue)
 *   cost         — 지출·원가·손실 (red) — costDirect와 동일 계열(같은 "원가")
 *   profit       — 이익 절대금액 (green)
 *   rate         — 이익율(%) 등 비율 지표 (violet)
 *   costLabor    — 원가구성 도넛: 인건비 (aqua)
 *   costOverhead — 원가구성 도넛: 관리비 (yellow)
 */
export interface ChartPalette {
  revenue:      string;
  cost:         string;
  profit:       string;
  rate:         string;
  costDirect:   string;
  costLabor:    string;
  costOverhead: string;
}

/** 데이터 시리즈 색과 별개로, 축 눈금·격자선·데이터라벨 텍스트에 쓰는 차트 "크롬" 색 — 3탭 공용 */
export interface ChartTheme {
  labelColor: string;
  gridColor:  string;
  tickColor:  string;
}

export const getChartTheme = (dark: boolean): ChartTheme => dark ? {
  labelColor: 'rgba(255,255,255,0.95)',
  gridColor:  'rgba(90,90,100,0.55)',
  tickColor:  'rgba(230,230,236,0.95)',
} : {
  labelColor: '#111111',
  gridColor:  'rgba(0,0,0,0.08)',
  tickColor:  '#1E1E1E',
};

// fadeAlpha(PerformanceChartSection)가 마지막 숫자를 정규식으로 치환하는 방식이라
// rgba(...) 형식(알파 1) 유지 — 순수 hex로 바꾸면 미래월 페이드 효과가 조용히 깨짐
export const getChartPalette = (dark: boolean): ChartPalette => dark ? {
  revenue:      'rgba(57,135,229,1)',   /* blue */
  cost:         'rgba(230,103,103,1)',  /* red */
  profit:       'rgba(0,131,0,1)',      /* green */
  rate:         'rgba(144,133,233,1)',  /* violet */
  costDirect:   'rgba(230,103,103,1)',  /* red — cost와 동일 */
  costLabor:    'rgba(25,158,112,1)',   /* aqua */
  costOverhead: 'rgba(201,133,0,1)',    /* yellow */
} : {
  revenue:      'rgba(42,120,214,1)',   /* blue */
  cost:         'rgba(227,73,72,1)',    /* red */
  profit:       'rgba(0,131,0,1)',      /* green */
  rate:         'rgba(74,58,167,1)',    /* violet */
  costDirect:   'rgba(227,73,72,1)',    /* red — cost와 동일 */
  costLabor:    'rgba(27,175,122,1)',   /* aqua */
  costOverhead: 'rgba(237,161,0,1)',    /* yellow */
};
