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
