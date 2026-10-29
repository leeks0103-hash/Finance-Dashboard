import { describe, it, expect } from 'vitest';
import { tightLabelsPlugin, costRateTuning } from './PerformanceChartSection';
import { CHART_TUNING } from './chartTuning';

// 플러그인 훅 호출용 느슨한 타입 — 실제 Chart 인스턴스 없이 가짜 컨텍스트만 넘김
type Hook = (chart: unknown, args: object, opts: object) => void;
const hooks = tightLabelsPlugin as unknown as Record<'beforeDatasetsDraw' | 'afterDatasetsDraw' | 'afterDraw', Hook>;

// 캔버스 대신 fillText가 불린 순간의 letterSpacing을 기록하는 가짜 컨텍스트
const makeChart = (tightLabels: { spacing: string; whiteSpacing?: string }) => {
  const calls: { text: string; spacing: string | undefined }[] = [];
  const proto = {
    fillStyle: '#000000',
    letterSpacing: '0px' as string | undefined,
    fillText(this: { letterSpacing?: string }, text: string) { calls.push({ text, spacing: this.letterSpacing }); },
  };
  const ctx = Object.create(proto) as typeof proto;   // 실제 캔버스처럼 fillText는 프로토타입에 있음
  const chart = { ctx, options: { plugins: { tightLabels } } } as unknown;
  return { chart, ctx, calls, proto };
};

const draw = (chart: unknown, ctx: { fillStyle: string; fillText: (t: string) => void }) => {
  hooks.beforeDatasetsDraw(chart, {}, {});
  ctx.fillStyle = '#ffffff'; ctx.fillText('inner');   // 막대 안 흰색 수치
  ctx.fillStyle = '#8b5a2b'; ctx.fillText('total');   // 막대 위 합계(원가색)
};

describe('tightLabelsPlugin 막대 안쪽 흰색 수치만 다른 자간(2026-10-29)', () => {
  it('whiteSpacing이 있으면 흰색 글씨만 그 자간, 나머지는 spacing', () => {
    const { chart, ctx, calls } = makeChart({ spacing: '-0.8px', whiteSpacing: '0.5px' });
    draw(chart, ctx);
    expect(calls).toEqual([{ text: 'inner', spacing: '0.5px' }, { text: 'total', spacing: '-0.8px' }]);
  });

  it('whiteSpacing이 없으면 예전처럼 전부 spacing(다른 차트는 그대로)', () => {
    const { chart, ctx, calls } = makeChart({ spacing: '-0.3px' });
    draw(chart, ctx);
    expect(calls.map(c => c.spacing)).toEqual(['-0.3px', '-0.3px']);
  });

  it('수치를 그린 뒤(afterDatasetsDraw)에는 감싼 fillText를 풀어 뒤에 그려지는 글씨(툴팁 등)엔 영향 없다', () => {
    const { chart, ctx, calls, proto } = makeChart({ spacing: '-0.8px', whiteSpacing: '0.5px' });
    draw(chart, ctx);
    hooks.afterDatasetsDraw(chart, {}, {});
    expect(Object.prototype.hasOwnProperty.call(ctx, 'fillText')).toBe(false);   // 인스턴스에 얹은 것 제거
    expect(ctx.fillText).toBe(proto.fillText);                                    // 원래 함수로 복귀
    ctx.fillStyle = '#ffffff'; ctx.fillText('tooltip');
    expect(calls[calls.length - 1]).toEqual({ text: 'tooltip', spacing: '-0.8px' });   // 흰색이어도 더는 whiteSpacing을 안 씀
  });

  it('그릴 때마다 반복해도 겹쳐 감싸지 않는다', () => {
    const { chart, ctx, calls } = makeChart({ spacing: '-0.8px', whiteSpacing: '0.5px' });
    draw(chart, ctx);
    hooks.afterDatasetsDraw(chart, {}, {});
    draw(chart, ctx);
    expect(calls.slice(2).map(c => c.spacing)).toEqual(['0.5px', '-0.8px']);
    hooks.afterDraw(chart, {}, {});
    expect(ctx.letterSpacing).toBe('0px');
  });
});

describe('costRateTuning 원가율 글씨만의 자간(2026-10-29)', () => {
  it('조절표에 spacing이 있으면 px 문자열로 넘기고, 없으면 옵션에서 뺀다(차트 전체 자간을 따름)', () => {
    expect(costRateTuning({ costRate: { lift: 41, fontPx: 11, spacing: -0.3 } })).toMatchObject({ spacing: '-0.3px' });
    expect('spacing' in costRateTuning({ costRate: { lift: 39, fontPx: 12 } })).toBe(false);
    expect(costRateTuning({})).toEqual({});
  });

  it('월별(진도율·2027 월별)만 값이 있고 원가분석은 그대로(자간 지정 없음)', () => {
    expect(CHART_TUNING.monthly.costRate?.spacing).toBe(-0.1);
    expect(CHART_TUNING.profitRate.costRate?.spacing).toBeUndefined();
  });
});
