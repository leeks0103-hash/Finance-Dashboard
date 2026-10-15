import { describe, it, expect } from 'vitest';
import { extractRealCode, countFinanceHistory } from './projectCode';

describe('extractRealCode', () => {
  it('정식 코드 그대로', () => {
    expect(extractRealCode('E148600126040002')).toBe('E148600126040002');
  });
  it('뒤에 붙은 placeholder 주석은 떼고 앞 코드만', () => {
    expect(extractRealCode('E147600126030001 (생성 예정)')).toBe('E147600126030001');
    expect(extractRealCode('E147600126030001(생성예정)')).toBe('E147600126030001');
  });
  it('뒤에 _나 글자를 붙여 만든 다른 코드는 정식 코드로 안 봄', () => {
    expect(extractRealCode('E148600126040002_SW')).toBeNull();
    expect(extractRealCode('E148600126040002_EM')).toBeNull();
    expect(extractRealCode('E148600126040002A')).toBeNull();
  });
  it('코드가 없는 placeholder는 null', () => {
    expect(extractRealCode('생성예정')).toBeNull();
    expect(extractRealCode('선정 시 생성 예정')).toBeNull();
  });
});

describe('countFinanceHistory', () => {
  const codes = { E148600126040002: 2, E148600126040001: 3 };
  it('정식 코드는 재무 이력 건수', () => {
    expect(countFinanceHistory('E148600126040002', codes)).toBe(2);
  });
  it('_SW/_EM처럼 붙여 만든 코드는 배지 없음', () => {
    expect(countFinanceHistory('E148600126040002_SW', codes)).toBe(0);
    expect(countFinanceHistory('E148600126040002_EM', codes)).toBe(0);
  });
});
