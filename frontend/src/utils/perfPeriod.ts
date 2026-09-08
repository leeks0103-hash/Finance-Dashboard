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

/**
 * 실적현황 엑셀(performance.py의 _PERF_COL_MAP_JUL)의 실제 열 문자 — 새 달 시트가
 * 추가되어 컬럼 배치가 밀리면(performance.py 컬럼맵 갱신 시) 여기도 같이 갱신할 것.
 */
export const PERF_COL = {
  planInitial:    'U',
  actualRange:    'BF~BL (1~7월 점검열 합계)',
  checkTotal:     'BE',
  operatingProfit:'BC',
  profitRate:     'BD',
  costDirect:     'AY',
  costLabor:      'AZ',
  costOverhead:   'BA',
  costMgmt:       'BB',
  progress:       'J',
} as const;
