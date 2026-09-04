/**
 * 실적현황 데이터 기준 시점 — app.py의 PERF_SHEET("2026년 (7월 추정)")와 반드시 맞춰서
 * 매달 갱신할 것. 이 값만 바꾸면 실적현황 탭의 "N월 실적" 류 라벨이 전부 갱신됨
 * (필드명 자체는 jun_est/jun_actual 등으로 남아있음 — 리네이밍은 별도 작업).
 */
export const PERF_YEAR = '2026년';
export const PERF_MONTH = '7월';

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
