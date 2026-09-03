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

/** KPI 취합 셀 값 정규화 — 미입력/0은 "-", 명시적 해당없음(N/n)은 "N" */
export const cellVal = (v: unknown): string => {
  if (v === null || v === undefined || v === '' || v === 0 || v === '0') return '-';
  const s = String(v).trim();
  if (s === 'N' || s === 'n') return 'N';
  return s;
};

const IMPLAUSIBLE_SCORE_THRESHOLD = 10;

/**
 * "_적절성" 지표는 0~5 내외 척도인데, PPT 원본에 인원수 등 엉뚱한 값이 잘못 들어가면
 * 수십~수만대 값이 찍히는 경우가 있음 (known-issues.md 기록된 패턴) — 행 배경으로 경고 표시
 */
export const isImplausibleScoreRow = (row: Record<string, unknown>, metricKey: string): boolean => {
  if (!metricKey.endsWith('_적절성')) return false;
  return ['사업계획', 'PJ목표', 'PJ실적', 'PJ유사'].some(field => {
    const n = Number(row[`${metricKey}_${field}`]);
    return Number.isFinite(n) && n > IMPLAUSIBLE_SCORE_THRESHOLD;
  });
};
