const KO = new Intl.NumberFormat('ko-KR');

export const formatWon = (v: number): string =>
  KO.format(Math.round(v)) + '원';

// 소수 6자리까지 — 원본의 실제 소수는 살리고 부동소수점 꼬리(…00000001)만 잘라냄
const KO_RAW = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 });

/**
 * 실제값 표시 — 반올림·억/만 단위 축약 없이 원본 숫자에 콤마만 찍음.
 * 설정 > 표 실제값 토글(ui.store showRawValues)이 켜졌을 때 금액·비율 셀에서 사용
 */
export const formatRaw = (v: number): string =>
  v == null || !isFinite(v) ? '-' : KO_RAW.format(v);

/**
 * 원 단위 입력 → 억/만/원 3단 캐스케이드 표시.
 * 억 단위 하나만 쓰면 백만원대가 "0.0억원"으로, 만원 단위 하나만 써도 몇천/몇백/몇십원대는
 * "0만원"으로 뭉개져서 사실상 0처럼 보임 — 1000만원 이상 억 / 1만원 이상 만 / 그 미만 원 그대로.
 * (정확히 0은 예외적으로 "0.0억원" 유지 — 값이 없다는 뜻이 아니라 실제 0원인 경우가 있어서)
 */
/**
 * 소수 digits자리까지 남기고 나머지는 버림(반올림 안 함, 2026-10-02 요청). 0 쪽으로 버림 — 음수에 Math.floor를 쓰면
 * -0.123 → -0.13처럼 절댓값이 커져서. 0.29×100 = 28.999… 같은 부동소수점 오차는 아주 작은 값을 더해 바로잡음
 */
const truncTo = (v: number, digits: number): string => {
  const f = 10 ** digits;
  const t = Math.trunc(v * f + Math.sign(v) * 1e-9) / f;
  return t.toFixed(digits);
};

export const formatBillion = (v: number): string => {
  if (v == null || !isFinite(v)) return '-';
  if (v === 0) return '0.00억원';
  const abs = Math.abs(v);
  // 억은 소수 둘째 자리까지 버림(예: 1,234만원 → 0.12억원), 만·원도 반올림 대신 버림(2026-10-02)
  if (abs >= 1e7) return truncTo(v / 1e8, 2) + '억원';
  if (abs >= 1e4) return Math.trunc(v / 1e4).toLocaleString() + '만원';
  return Math.trunc(v).toLocaleString() + '원';
};

export const formatRate = (v: number): string => {
  if (v == null || !isFinite(v)) return '-';
  // 부동소수점 오류 방지: 정수 변환 후 toFixed(2) (1.45 → "1.45%" 보장)
  return (Math.round(v * 100) / 100).toFixed(2) + '%';
};

/** 원 단위 금액 — raw(실제값 토글)면 원본 그대로, 아니면 억/만 축약(formatBillion) */
export const formatMoney = (v: number, raw?: boolean): string =>
  raw ? formatRaw(v) : formatBillion(v);

/** % 단위 비율 — raw면 원본 소수 그대로, 아니면 소수 둘째자리 반올림(formatRate) */
export const formatPercent = (v: number, raw?: boolean): string =>
  raw ? (v == null || !isFinite(v) ? '-' : formatRaw(v) + '%') : formatRate(v);

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
  // 억은 소수 둘째 자리까지 버림, 만·원도 반올림 대신 버림(2026-10-02) — formatBillion과 같은 규칙
  if (abs >= 1e7) return truncTo(won / 1e8, 2) + '억';
  if (abs >= 1e4) return Math.trunc(won / 1e4).toLocaleString() + '만';
  return Math.trunc(won).toLocaleString() + '원';
};

/** 소수 비율 → % 표시. 0이면 '-' */
export const formatPctRaw = (v: number): string =>
  v ? `${(v * 100).toFixed(1)}%` : '-';

/** 천원 금액 — raw면 원 단위 실제값(×1000, 원 미만 반올림 — 툴팁과 동일), 아니면 억/만 축약(formatEok). 0이면 '-' */
export const formatEokOrRaw = (v: number, raw?: boolean): string =>
  raw ? (!v || !isFinite(v) ? '-' : formatRaw(Math.round(v * 1000))) : formatEok(v);

/** 소수 비율 — raw면 ×100한 원본 그대로, 아니면 소수 첫째자리(formatPctRaw). 0이면 '-' */
export const formatPctOrRaw = (v: number, raw?: boolean): string =>
  raw ? (!v || !isFinite(v) ? '-' : formatRaw(v * 100) + '%') : formatPctRaw(v);

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

const VALUE_UNIT_RE = /^([-+]?[\d,]*\.?\d+)(.*)$/;

/**
 * "137.0억원" → { num: "137.0", unit: "억원" }. 숫자 자릿수가 카드마다 달라
 * (10.0 vs 137.0) 단위가 뒤로/앞으로 밀려 보이는 문제 — 숫자와 단위를 분리 렌더링해서
 * 숫자 칸 폭을 고정(text-align:right)하면 단위 위치가 항상 같은 자리에 고정된다.
 * 숫자로 시작하지 않는 값("-" 등)은 그대로 num에, unit은 빈 문자열로 폴백.
 */
export const splitValueUnit = (value: string): { num: string; unit: string } => {
  const m = value.match(VALUE_UNIT_RE);
  return m ? { num: m[1], unit: m[2] } : { num: value, unit: '' };
};

/** 천원 → 억원 숫자(소수 첫째 자리) — 차트·표 표시용. null/undefined가 들어와도 NaN 대신 0 */
export const toEokNum = (v: number | null | undefined) =>
  Number.isFinite(Number(v)) ? +(Number(v) / 100_000).toFixed(1) : 0;

/** OS "움직임 줄이기" 설정 — 켜져 있으면 애니메이션 없이 즉시 전환 */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** 표 셀 툴팁(원 단위 금액) — 셀은 억/만 축약이라 마우스오버 시 정확한 값을 쉼표 붙여 보여줌. 0·빈 값이면 툴팁 없음 */
export const wonTitle = (v: unknown): string | undefined => {
  const n = Number(v);
  return n && isFinite(n) ? `${KO.format(Math.round(n))}원` : undefined;
};

/** 표 셀 툴팁(% 비율) — 원본 소수 그대로(둘째 자리 이하까지) */
export const pctTitle = (v: unknown): string | undefined => {
  const n = Number(v);
  return n && isFinite(n) ? `${KO.format(n)}%` : undefined;
};
