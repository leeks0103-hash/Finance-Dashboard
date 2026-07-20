const KO = new Intl.NumberFormat('ko-KR');

export const formatWon = (v: number): string =>
  KO.format(Math.round(v)) + '원';

export const formatBillion = (v: number): string => {
  const b = v / 1e8;
  if (Math.abs(b) >= 1) return b.toFixed(1) + '억원';
  return KO.format(Math.round(v / 1e4)) + '만원';
};

export const formatRate = (v: number): string =>
  v.toFixed(1) + '%';

export const formatCount = (v: number): string =>
  v + '건';
