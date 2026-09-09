/**
 * 실적현황 데이터 기준 시점 — 실적 엑셀은 항상 **전월 결산/추정** 시트가 최신이므로
 * (예: 9월에는 "2026년 (8월 추정)") 현재 달 - 1 로 자동 계산한다. 매달 손댈 필요 없음.
 *
 * `Date.getMonth()` 가 0-based라 그 값 자체가 곧 "전월"이 된다 (9월 → 8).
 * 1월이면 전년 12월로 넘어감.
 *
 * ※ 더 엄밀히는 백엔드가 실제로 읽은 시트명(performance.py `_resolve_perf_sheet`)이
 *   정답이다. 팀 마감이 밀려 시트가 두 달 전이면 이 계산과 어긋날 수 있음 —
 *   그때는 `/api/performance/summary` 에 기준월을 실어보내 여기서 읽도록 바꿀 것.
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
const _monthNum = parseInt(PERF_MONTH, 10);

/**
 * 실적현황 엑셀(performance.py `_PERF_COL_MAPS`의 현재 활성 시트, 2026-09-09 기준 8월 시트
 * `_PERF_COL_MAP_AUG`)의 실제 열 문자. 새 달 시트가 추가돼 컬럼 배치가 밀리면
 * (performance.py 컬럼맵 갱신 시) CHK_M01_COL과 아래 값들을 같이 갱신할 것.
 */
export const PERF_COL = {
  planInitial:    'V',
  // 1월~기준월(PERF_MONTH) 점검열 합계 — CHK_M01_COL 기준으로 매달 자동 계산되므로
  // 컬럼 배치가 그대로면(월만 넘어가면) 손댈 필요 없음
  actualRange:    `${CHK_M01_COL}~${colAdd(CHK_M01_COL, _monthNum - 1)} (1~${PERF_MONTH} 점검열 합계)`,
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
