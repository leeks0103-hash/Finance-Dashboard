import { describe, it, expect } from 'vitest';
import { tightNegativeMin } from './chartTuning';

describe('tightNegativeMin (마이너스 막대가 있는 가로 막대의 축 최소값)', () => {
  it('마이너스가 없으면 undefined — Chart.js 자동 범위 그대로', () => {
    expect(tightNegativeMin([0.36, 0.16, 1.64])).toBeUndefined();
    expect(tightNegativeMin([0, 0])).toBeUndefined();
    expect(tightNegativeMin([])).toBeUndefined();
  });

  it('인당 손익 실제 값(-0.01억 하나, 최대 1.64억): 자동 범위(-0.5억)보다 훨씬 좁게 — 가장 작은 값에서 전체 폭의 4%만 더 내림', () => {
    const min = tightNegativeMin([0.36, -0.01, 0.16, 0.2, 0.41, 0.21, 1.64])!;
    expect(min).toBeLessThan(-0.01);          // 막대와 축 사이에 틈이 있음
    expect(min).toBeCloseTo(-0.01 - (1.64 + 0.01) * 0.04, 10);
    expect(min).toBeGreaterThan(-0.2);        // 자동 범위(-0.5)처럼 크게 비지 않음
  });

  it('마이너스가 큰 경우에도 그 값보다는 항상 더 아래', () => {
    const min = tightNegativeMin([-1.2, 0.5, 0.8])!;
    expect(min).toBeLessThan(-1.2);
    expect(min).toBeCloseTo(-1.2 - 2.0 * 0.04, 10);
  });

  it('전부 마이너스면 0까지를 폭으로 봄', () => {
    const min = tightNegativeMin([-0.4, -0.1])!;
    expect(min).toBeCloseTo(-0.4 - 0.4 * 0.04, 10);
  });

  it('null·NaN·Infinity는 무시', () => {
    expect(tightNegativeMin([null, undefined, Number.NaN, Number.POSITIVE_INFINITY, 0.3])).toBeUndefined();
    const min = tightNegativeMin([null, -0.2, 1])!;
    expect(min).toBeCloseTo(-0.2 - 1.2 * 0.04, 10);
  });
});
