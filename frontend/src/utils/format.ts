const KO = new Intl.NumberFormat('ko-KR');

export const formatWon = (v: number): string =>
  KO.format(Math.round(v)) + '원';

export const formatBillion = (v: number): string => {
  if (v == null || !isFinite(v)) return '-';
  return (v / 1e8).toFixed(1) + '억원';
};

export const formatRate = (v: number): string =>
  v != null && isFinite(v) ? v.toFixed(1) + '%' : '-';

export const formatCount = (v: number): string =>
  v + '건';

// ── 실적 데이터용 포맷 (단위: 천원) ──────────────────────────
/** 천원 → 억원 표시. 0이면 '-' */
export const formatEok = (v: number): string =>
  (!v ? '-' : (v / 100_000).toFixed(1) + '억');

/** 소수 비율 → % 표시. 0이면 '-' */
export const formatPctRaw = (v: number): string =>
  v ? `${(v * 100).toFixed(1)}%` : '-';

/** 숫자 → 로컬 형식 표시. 0이면 '-' */
export const formatNum = (v: number): string =>
  v ? v.toLocaleString() : '-';
