import { describe, it, expect, vi } from 'vitest';
import { costRateLinePlugin, monthlyCostRates, rateBand, rateY, type CostRateLineOpts } from './costRateLine';

describe('monthlyCostRates', () => {
  it('원가 ÷ 매출을 소수 첫째 자리로 — 막대 위 원가율(costRatePlugin)과 같은 값', () => {
    expect(monthlyCostRates([18.2, 32.8], [10.3, 19.6])).toEqual([56.6, 59.8]);
  });

  it('매출이나 원가가 0 이하라 못 구하면 null — 선이 끊기고 "–"로 표시', () => {
    expect(monthlyCostRates([0, 10, 10, -1], [5, 0, 4, 3])).toEqual([null, null, 40, null]);
  });

  it('원가가 매출을 넘으면 100% 초과로 그대로(적자 달)', () => {
    expect(monthlyCostRates([36, 40], [37.8, 20])).toEqual([105, 50]);
  });
});

describe('rateBand — 띠의 세로 범위', () => {
  it('실제 최소~최대에 맞춤', () => {
    const b = rateBand([40, 85, null])!;
    expect(b.span).toBe(45);
    expect(b.lo).toBe(40);
  });

  it('값이 거의 같아도 최소 8%p 폭을 유지 — 작은 차이가 요동처럼 과장되지 않음', () => {
    const b = rateBand([55.0, 55.7, 55.3])!;
    expect(b.span).toBe(8);
    // 55.0~55.7이 띠(26~46px)의 가운데 근처에 모여 거의 일자선
    const ys = [55.0, 55.7].map(v => rateY(v, b));
    expect(Math.abs(ys[0] - ys[1])).toBeLessThan(2);
    expect(ys[0]).toBeGreaterThan(30);
    expect(ys[0]).toBeLessThan(42);
  });

  it('값이 하나도 없으면 null', () => {
    expect(rateBand([null, null])).toBeNull();
    expect(rateBand([])).toBeNull();
  });

  it('값이 클수록 위(작은 y)', () => {
    const b = rateBand([50, 60])!;
    expect(rateY(60, b)).toBeLessThan(rateY(50, b));
  });
});

describe('costRateLinePlugin', () => {
  const makeChart = (opts: Partial<CostRateLineOpts> | undefined) => {
    const calls = { fillText: [] as string[], stroke: 0, arc: 0 };
    const ctx = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), fill: vi.fn(), setLineDash: vi.fn(),
      stroke: vi.fn(() => { calls.stroke += 1; }),
      arc: vi.fn(() => { calls.arc += 1; }),
      fillText: vi.fn((t: string) => { calls.fillText.push(t); }),
      globalAlpha: 1, font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: '', textBaseline: '', lineJoin: '',
    };
    const chart = {
      ctx,
      options: { plugins: opts ? { costRateLine: { show: true, rates: [], future: [], color: '#0a0', lossColor: '#f00', mutedColor: '#888', pointFill: '#fff', ...opts } } : {} },
      scales: { x: { getPixelForValue: (i: number) => 50 + i * 70 } },
    };
    return { chart, calls };
  };
  const run = (chart: unknown) => (costRateLinePlugin.afterDatasetsDraw as unknown as (c: unknown) => void)(chart);

  it('show가 false이거나 옵션이 없으면 아무것도 안 그림(= COST_RATE_STYLE이 floating일 때)', () => {
    const off = makeChart({ show: false, rates: [55, 56] });
    run(off.chart);
    expect(off.calls.fillText).toEqual([]);
    const none = makeChart(undefined);
    run(none.chart);
    expect(none.calls.fillText).toEqual([]);
  });

  it('캡션·월별 수치를 그리고, 점은 값이 있는 달마다 하나, 선은 이어진 구간마다 하나', () => {
    const { chart, calls } = makeChart({ rates: [56.6, 56.3, 57.4], future: [false, false, false] });
    run(chart);
    expect(calls.fillText).toEqual(['원가율', '56.6%', '56.3%', '57.4%']);
    expect(calls.arc).toBe(3);
    expect(calls.stroke).toBe(2 + 3);   // 선 2구간 + 점 테두리 3
  });

  it('값이 없는 달은 "–"로 표시하고 그 달을 지나는 선은 끊김(점도 없음)', () => {
    const { chart, calls } = makeChart({ rates: [null, 62.0, 58.5], future: [false, false, false] });
    run(chart);
    expect(calls.fillText).toContain('–');
    expect(calls.arc).toBe(2);
    expect(calls.stroke).toBe(1 + 2);   // 선 1구간(2~3월) + 점 테두리 2 — 1월과 이어지는 구간 없음
  });
});
