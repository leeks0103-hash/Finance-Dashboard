const KO = new Intl.NumberFormat('ko-KR');

export const formatWon = (v: number): string =>
  KO.format(Math.round(v)) + '원';

export const formatBillion = (v: number): string => {
  if (v == null || !isFinite(v)) return '-';
  const eok = v / 1e8;
  // 0.1억 미만이면 만원 단위로 표시 (0.01억원 → 1만원 형태 방지)
  if (Math.abs(eok) < 0.1 && eok !== 0) {
    return (v / 1e4).toFixed(0) + '만원';
  }
  return eok.toFixed(1) + '억원';
};

export const formatRate = (v: number): string => {
  if (v == null || !isFinite(v)) return '-';
  // 부동소수점 오류 방지: 정수 변환 후 toFixed(2) (1.45 → "1.45%" 보장)
  return (Math.round(v * 100) / 100).toFixed(2) + '%';
};

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
