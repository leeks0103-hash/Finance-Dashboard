import { describe, it, expect } from 'vitest';
import { extractRealCode, countFinanceHistory, pickAutoExpandRow } from './projectCode';

describe('pickAutoExpandRow — 완료 보고가 정확히 1건일 때만', () => {
  const row = (project_code: string) => ({ project_code });
  const completed = { E148600126040002: 1, E148600126040001: 2 };
  it('완료 보고가 있는 행이 하나뿐이고 1건이면 그 행', () => {
    const a = row('E148600126040002');
    expect(pickAutoExpandRow([row('E999900000000001'), a], completed)).toBe(a);
  });
  it('완료 보고가 2건 이상이면 안 펼침', () => {
    expect(pickAutoExpandRow([row('E148600126040001')], completed)).toBeNull();
  });
  it('완료 보고가 있는 행이 여럿이면 안 펼침', () => {
    expect(pickAutoExpandRow([row('E148600126040002'), row('E148600126040001')], completed)).toBeNull();
  });
  it('완료 보고가 없으면(재무 이력만 있어도) 안 펼침', () => {
    expect(pickAutoExpandRow([row('E999900000000001')], completed)).toBeNull();
    expect(pickAutoExpandRow([], completed)).toBeNull();
  });
  it('완료 코드 맵이 아직 없으면 안 펼침', () => {
    expect(pickAutoExpandRow([row('E148600126040002')], undefined)).toBeNull();
  });
});

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
