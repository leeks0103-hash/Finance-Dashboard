/**
 * 실적현황 데이터 기준 시점 — 정답은 백엔드가 실제로 읽은 시트(performance.py `_resolve_perf_sheet`)이고,
 * `/api/performance/summary`의 `base`로 내려온다 → 화면에선 `usePerfPeriod()`(hooks)로 읽을 것.
 *
 * 아래 상수는 그 응답이 오기 전·옛 서버용 **폴백** — "오늘 - 1개월"로 짐작한다.
 * ⚠️ 이 짐작은 팀 마감보다 달력이 먼저 넘어가면 틀림: 10월 1일에 9월 시트가 아직 없는데도 9월을
 *   실적으로 칠했음(2026-10-01). 그래서 화면은 base를 우선으로 씀.
 * `Date.getMonth()` 가 0-based라 그 값 자체가 곧 "전월"이 된다 (9월 → 8). 1월이면 전년 12월.
 */
const _now = new Date();
const _prevMonth = _now.getMonth();  // 0-based == 전월(1~11), 1월이면 0
export const PERF_YEAR  = `${_prevMonth === 0 ? _now.getFullYear() - 1 : _now.getFullYear()}년`;
export const PERF_MONTH = `${_prevMonth === 0 ? 12 : _prevMonth}월`;

/** 엑셀 열 문자에 n을 더한 열 문자 반환 (예: colAdd('BI', 3) → 'BL') — 26진법 변환 */
const colAdd = (col: string, n: number): string => {
  let idx = 0;
  for (const ch of col) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  idx += n;
  let out = '';
  while (idx > 0) {
    const rem = (idx - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    idx = Math.floor((idx - 1) / 26);
  }
  return out;
};

// chk_m01(1월 점검) 열 — performance.py _PERF_COL_MAPS의 "현재 활성 시트" 맵과 일치해야 함.
// 컬럼맵이 또 밀리면(신규 컬럼 삽입 등) 여기 한 곳만 갱신하면 actualRange가 자동으로 따라감.
const CHK_M01_COL = 'BI';   // 8월 시트(ver8.3_260901) 기준 — performance.py _PERF_COL_MAP_AUG 참고

/** 1~기준월 점검열 범위 설명 — 예: 8 → "BI~BP (1~8월 점검열 합계)" */
export const perfActualRange = (monthNum: number): string =>
  `${CHK_M01_COL}~${colAdd(CHK_M01_COL, monthNum - 1)} (1~${monthNum}월 점검열 합계)`;

/**
 * 실적현황 엑셀(performance.py `_PERF_COL_MAPS`의 현재 활성 시트, 2026-09-09 기준 8월 시트
 * `_PERF_COL_MAP_AUG`)의 실제 열 문자. 새 달 시트가 추가돼 컬럼 배치가 밀리면
 * (performance.py 컬럼맵 갱신 시) CHK_M01_COL과 아래 값들을 같이 갱신할 것.
 */
export const PERF_COL = {
  planInitial:    'V',
  // 1월~기준월 점검열 합계(폴백 기준월) — 화면에선 perfActualRange(기준월)로 실제 기준월에 맞춰 씀
  actualRange:    perfActualRange(parseInt(PERF_MONTH, 10)),
  // chk_m01~chk_m12 전체 12개월 열 범위 — 월별 실적 추이 차트 ⓘ 설명용
  chkFullYearRange: `${CHK_M01_COL}~${colAdd(CHK_M01_COL, 11)}`,
  checkTotal:     'BH',
  operatingProfit:'BF',
  profitRate:     'BG',
  costDirect:     'BB',
  costLabor:      'BC',
  costOverhead:   'BD',
  costMgmt:       'BE',
  progress:       'J',
} as const;
