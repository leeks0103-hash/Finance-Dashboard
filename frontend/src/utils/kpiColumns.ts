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

/**
 * 화면 표기 교정 — 엑셀 원본 컬럼명의 오기를 표시용으로만 바로잡는다.
 * 키 자체를 고치려면 extract_kpi_ppt.py + 기존 엑셀 데이터까지 마이그레이션해야 해서
 * (재추출 필요) 데이터는 그대로 두고 헤더 문자열만 치환한다.
 */
const COL_LABEL_FIXES: [RegExp, string][] = [
  [/신사업_매출억/, '신사업_매출액'],   // "억"은 단위지 지표명이 아님
];

/** KPI 취합 flat 뷰 헤더 표기 — 원본 컬럼명에 오기가 있으면 교정해서 반환 */
export const kpiColLabel = (col: string): string =>
  COL_LABEL_FIXES.reduce((s, [re, to]) => s.replace(re, to), col);

/**
 * KPI 취합 셀 값 정규화 — 미입력/0은 "-", 명시적 해당없음(N/n)은 "N".
 * metricKey가 "_적절성"(0~5 척도) 지표면 한 자리 수 점수를 소수점 첫째 자리까지 통일 표시
 * (예: 평균이 딱 4로 떨어지면 "4"가 아니라 "4.0") — 다른 행의 "4.33" 같은 표기와 자릿수를 맞춘다.
 */
export const cellVal = (v: unknown, metricKey?: string): string => {
  if (v === null || v === undefined || v === '' || v === 0 || v === '0') return '-';
  const s = String(v).trim();
  if (s === 'N' || s === 'n') return 'N';
  if (metricKey?.endsWith('_적절성')) {
    const n = Number(v);
    if (Number.isFinite(n) && Math.abs(n) < 10) return n.toFixed(1);
  }
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
