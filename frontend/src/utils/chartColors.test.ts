import { describe, expect, it } from 'vitest';
import {
  colorClashes, colorWarnings, getChartPalette, normalizeHex, sanitizeChartColors, sanitizeChartColorSet,
} from './chartColors';

describe('normalizeHex', () => {
  it('3자리·대문자·# 없는 값을 #rrggbb 소문자로', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('ff0000')).toBe('#ff0000');
    expect(normalizeHex(' #00AAD2 ')).toBe('#00aad2');
  });
  it('형식이 틀리면 null', () => {
    for (const v of ['#12345', '#ggg000', 'red', '', null, 123, '#ff000080']) expect(normalizeHex(v)).toBeNull();
  });
});

describe('sanitizeChartColors', () => {
  it('모르는 역할·견본·틀린 hex는 버림', () => {
    expect(sanitizeChartColors({
      revenue: 'gold', cost: '#FF0000', loss: 'purple', plan: '#xyz', nope: 'navy',
    })).toEqual({ revenue: 'gold', cost: '#ff0000' });
  });
  it('객체가 아니면 빈 값', () => {
    for (const v of [null, undefined, 'x', 3, ['navy']]) expect(sanitizeChartColors(v)).toEqual({});
  });
});

describe('getChartPalette', () => {
  it('직접 넣은 색 반영', () => {
    expect(getChartPalette(false, { revenue: '#123456' }).revenue).toBe('rgba(18,52,86,1)');
  });
  it('흰색처럼 배경과 같은 색은 보이게 보정', () => {
    expect(getChartPalette(false, { loss: '#ffffff' }).loss).not.toBe('rgba(255,255,255,1)');
  });
  it('다크에선 어두운 색을 밝힘', () => {
    expect(getChartPalette(true, { revenue: '#000000' }).revenue).not.toBe('rgba(0,0,0,1)');
  });
  it('깨진 값이 섞여도 터지지 않고 기본값', () => {
    const bad = { revenue: 42 } as unknown as Parameters<typeof getChartPalette>[1];
    expect(getChartPalette(false, bad).revenue).toBe(getChartPalette(false).revenue);
  });
});

describe('경고', () => {
  it('아주 연한 색은 대비 경고', () => {
    expect(colorWarnings('#fafafa').length).toBeGreaterThan(0);
    expect(colorWarnings('navy')).toEqual([]);
  });
  it('같은 차트 역할끼리 비슷한 색이면 충돌', () => {
    expect(colorClashes('revenue', { cost: '#012d5f' })).toContain('cost');
    expect(colorClashes('revenue', {})).toEqual([]);
  });
});

describe('주간/야간 따로 저장(2026-10-19)', () => {
  it('옛 형식(한 벌)은 주간·야간 둘 다에 복사', () => {
    expect(sanitizeChartColorSet({ revenue: 'red' })).toEqual({ light: { revenue: 'red' }, dark: { revenue: 'red' } });
  });
  it('새 형식은 모드별로 검증, 깨진 값은 빈 값', () => {
    expect(sanitizeChartColorSet({ light: { cost: 'gold' }, dark: { cost: 'nope' } })).toEqual({ light: { cost: 'gold' }, dark: {} });
    expect(sanitizeChartColorSet(null)).toEqual({ light: {}, dark: {} });
  });
  it('야간 경고는 남색 배경 기준', () => {
    expect(colorWarnings('#0e2038', true).length).toBeGreaterThan(0);
    expect(colorWarnings('#fafafa', true)).toEqual([]);
  });
  it('경상손익도 고를 수 있음', () => {
    expect(getChartPalette(false, { costProfit: 'navy' }).costProfit).toBe('rgba(0,44,95,1)');
  });
});
