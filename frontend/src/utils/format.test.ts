import { describe, it, expect } from 'vitest';
import { formatWon, formatBillion, formatRate, formatCount, formatEok, formatPctRaw, formatNum } from './format';

describe('formatWon', () => {
  it('formats with 원 suffix and locale grouping', () => {
    expect(formatWon(1234567)).toBe('1,234,567원');
  });
});

describe('formatBillion', () => {
  it('formats large values in 억원', () => {
    expect(formatBillion(1_230_000_000)).toBe('12.30억원');
  });

  it('keeps 2 decimals in 억원 and truncates instead of rounding (toward zero)', () => {
    expect(formatBillion(19_999_999)).toBe('0.19억원');      // 반올림이면 0.20
    expect(formatBillion(10_000_000)).toBe('0.10억원');      // 천만원
    expect(formatBillion(29_000_000)).toBe('0.29억원');      // 부동소수점 오차(28.999…)에도 0.28이 되지 않음
    expect(formatBillion(-12_345_678)).toBe('-0.12억원');    // 음수도 0 쪽으로 버림(-0.13 아님)
    expect(formatBillion(5_999_999)).toBe('599만원');        // 만원도 버림
  });

  it('formats sub-0.1억 values in 만원', () => {
    expect(formatBillion(5_000_000)).toBe('500만원');
  });

  it('formats sub-1만원(몇천/몇백/몇십원대) values in 원 — not rounded to 0만원', () => {
    expect(formatBillion(3_000)).toBe('3,000원');
    expect(formatBillion(50)).toBe('50원');
  });

  it('formats exact zero as 0.00억원, not 만원', () => {
    expect(formatBillion(0)).toBe('0.00억원');
  });

  it('returns - for non-finite input', () => {
    expect(formatBillion(NaN)).toBe('-');
    expect(formatBillion(Infinity)).toBe('-');
  });
});

describe('formatRate', () => {
  it('formats with 2 decimal places and % suffix', () => {
    expect(formatRate(1.4)).toBe('1.40%');
  });

  it('avoids floating point rounding artifacts (naive toFixed would give 0.61%)', () => {
    expect(formatRate(0.615)).toBe('0.62%');
  });

  it('returns - for non-finite input', () => {
    expect(formatRate(NaN)).toBe('-');
  });
});

describe('formatCount', () => {
  it('appends 건', () => {
    expect(formatCount(7)).toBe('7건');
  });
});

describe('formatEok (천원 단위 입력)', () => {
  it('converts 천원 to 억 with 2 decimals, truncated', () => {
    expect(formatEok(150_000)).toBe('1.50억');
    expect(formatEok(10_000)).toBe('0.10억');     // 천만원
    expect(formatEok(19_999.9)).toBe('0.19억');   // 반올림이면 0.20
    expect(formatEok(-12_345.678)).toBe('-0.12억');
  });

  it('formats sub-0.1억(백만원대) values in 만 — not rounded to 0.0억', () => {
    expect(formatEok(1_000)).toBe('100만');
  });

  it('formats sub-1만원(몇천/몇백/몇십원대) values in 원 — not rounded to 0만', () => {
    expect(formatEok(3)).toBe('3,000원');
    expect(formatEok(0.05)).toBe('50원');
  });

  it('returns - for zero', () => {
    expect(formatEok(0)).toBe('-');
  });
});

describe('formatPctRaw (소수 비율 입력)', () => {
  it('converts ratio to percent string', () => {
    expect(formatPctRaw(0.235)).toBe('23.5%');
  });

  it('returns - for zero', () => {
    expect(formatPctRaw(0)).toBe('-');
  });
});

describe('formatNum', () => {
  it('formats with locale grouping', () => {
    expect(formatNum(1234567)).toBe('1,234,567');
  });

  it('returns - for zero', () => {
    expect(formatNum(0)).toBe('-');
  });
});
