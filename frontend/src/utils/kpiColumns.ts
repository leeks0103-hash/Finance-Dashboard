import type { KpiRawRow } from '@/types/kpi.types';

const FRONT   = ['프로젝트코드', '수행연도', '파트명', '보고단계'];
const TAIL    = ['파일명', '처리일시', '최종수정일시'];
const METRICS = ['NPS', '전략기술과정_건수', '전략기술과정_적절성', '특화교육체계_건수',
                 'AI교육_고객사건수', 'AI교육_적절성', '신사업_매출억', '신사업_신규기존건수'];

/** KPI 취합 원본 컬럼 정렬 — 식별자 앞으로, 비고 계열 제외, KPI 지표 순서 유지 */
export const sortKpiRawCols = (rows: KpiRawRow[]): string[] => {
  if (!rows.length) return [];
  const all   = Object.keys(rows[0]).filter(c => !/비고/.test(c) && c !== '_row_num');
  const front = FRONT.filter(c => all.includes(c));
  const tail  = TAIL.filter(c => all.includes(c));
  const rest  = all.filter(c => !FRONT.includes(c) && !TAIL.includes(c));

  const metricIdx = (col: string) => {
    const i = METRICS.findIndex(m => col === m || col.startsWith(m + '_'));
    return i >= 0 ? i : METRICS.length;
  };
  rest.sort((a, b) => metricIdx(a) - metricIdx(b));

  return [...front, ...rest, ...tail];
};
