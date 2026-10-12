import { describe, expect, it } from 'vitest';
import {
  colorClashes, colorWarnings, getChartPalette, normalizeHex, sanitizeChartColors,
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
