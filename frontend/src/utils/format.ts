const KO = new Intl.NumberFormat('ko-KR');

export const formatWon = (v: number): string =>
  KO.format(Math.round(v)) + '원';

/**
 * 원 단위 입력 → 억/만/원 3단 캐스케이드 표시.
 * 억 단위 하나만 쓰면 백만원대가 "0.0억원"으로, 만원 단위 하나만 써도 몇천/몇백/몇십원대는
 * "0만원"으로 뭉개져서 사실상 0처럼 보임 — 1000만원 이상 억 / 1만원 이상 만 / 그 미만 원 그대로.
 * (정확히 0은 예외적으로 "0.0억원" 유지 — 값이 없다는 뜻이 아니라 실제 0원인 경우가 있어서)
 */
export const formatBillion = (v: number): string => {
  if (v == null || !isFinite(v)) return '-';
  if (v === 0) return '0.0억원';
  const abs = Math.abs(v);
  if (abs >= 1e7) return (v / 1e8).toFixed(1) + '억원';
  if (abs >= 1e4) return Math.round(v / 1e4).toLocaleString() + '만원';
  return Math.round(v).toLocaleString() + '원';
};

export const formatRate = (v: number): string => {
  if (v == null || !isFinite(v)) return '-';
  // 부동소수점 오류 방지: 정수 변환 후 toFixed(2) (1.45 → "1.45%" 보장)
  return (Math.round(v * 100) / 100).toFixed(2) + '%';
};

export const formatCount = (v: number): string =>
  v + '건';

// ── 실적 데이터용 포맷 (단위: 천원) ──────────────────────────
/**
 * 천원 → 억/만/원 표시. 0이면 '-'.
 * 3단 캐스케이드 — 억 단위 toFixed(1) 하나만 쓰면 백만원대는 "0.0억"으로,
 * 만원 단위 하나만 써도 몇천/몇백/몇십원대는 "0만"으로 뭉개져서 사실상 0처럼
 * 보임(실측: 전기오류 일괄 인식 등 소액 보정 행에 이런 값이 실제로 있음).
 * 1000만원 이상 → 억 / 1만원 이상 → 만 / 그 미만 → 원 그대로.
 */
export const formatEok = (v: number): string => {
  if (!v || !isFinite(v)) return '-';
  const won = v * 1000;
  const abs = Math.abs(won);
  if (abs >= 1e7) return (won / 1e8).toFixed(1) + '억';
  if (abs >= 1e4) return Math.round(won / 1e4).toLocaleString() + '만';
  return Math.round(won).toLocaleString() + '원';
};

/** 소수 비율 → % 표시. 0이면 '-' */
export const formatPctRaw = (v: number): string =>
  v ? `${(v * 100).toFixed(1)}%` : '-';

/** 숫자 → 로컬 형식 표시. 0이면 '-' */
export const formatNum = (v: number): string =>
  v ? v.toLocaleString() : '-';

/**
 * 파트명 앞의 원문자 번호 제거 — "② SW" → "SW".
 * 엑셀 원본이 정렬용으로 붙여둔 접두어라 화면에는 노출하지 않는다.
 * (필터·집계 키로는 원본 문자열을 그대로 써야 하므로 표시할 때만 사용할 것)
 */
export const stripPartPrefix = (part: string): string =>
  String(part ?? '').replace(/^[①-⑳]\s*/, '');
