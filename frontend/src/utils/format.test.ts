import { describe, it, expect } from 'vitest';
import { formatWon, formatBillion, formatRate, formatCount, formatEok, formatPctRaw, formatNum } from './format';

describe('formatWon', () => {
  it('formats with 원 suffix and locale grouping', () => {
    expect(formatWon(1234567)).toBe('1,234,567원');
  });
});

describe('formatBillion', () => {
  it('formats large values in 억원', () => {
    expect(formatBillion(1_230_000_000)).toBe('12.3억원');
  });

  it('formats sub-0.1억 values in 만원', () => {
    expect(formatBillion(5_000_000)).toBe('500만원');
  });

  it('formats exact zero as 0.0억원, not 만원', () => {
    expect(formatBillion(0)).toBe('0.0억원');
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
  it('converts 천원 to 억 with 1 decimal', () => {
    expect(formatEok(150_000)).toBe('1.5억');
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
