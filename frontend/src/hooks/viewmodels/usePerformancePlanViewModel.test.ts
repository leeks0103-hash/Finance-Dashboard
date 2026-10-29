import { describe, it, expect } from 'vitest';
import { buildPlanChartData, COMPOSITION_LABELS } from './usePerformancePlanViewModel';
import type { PerfPlanSummary, PerfPlanPartStats } from '@/types/performance.types';

// 금액은 천원 — 100_000 = 1억
const part = (over: Partial<PerfPlanPartStats>): PerfPlanPartStats => ({
  rev26: 1_000_000, rev27: 1_200_000, cost26: 400_000, cost27: 500_000, rev_rate: 120,
  cost_direct: 500_000, cost_labor: 100_000, cost_overhead: 50_000, cost_mgmt: 80_000, operating_profit: 470_000,
  avg_profit_rate: 39.2, count: 3, headcount: null, headcount_partial: false,
  rev_per_head: null, profit_per_head: null, mgmt_per_head: null, ...over,
});

const summary = (by_part: Record<string, PerfPlanPartStats>): PerfPlanSummary => ({
  view: 'plan27', year: 2027, sheet: '2027년 (사업계획)',
  total: {
    y26: { revenue: 0, cost: 0, overhead: null, labor: null, mgmt: null, profit: null, gross: null },
    y27: { revenue: 2_400_000, cost: 1_000_000, overhead: 100_000, labor: 200_000, mgmt: 160_000, profit: 940_000, gross: 1_300_000 },
    rate: {}, cost_direct: 1_000_000, cost_labor: 200_000, cost_overhead: 100_000, cost_mgmt: 160_000,
    operating_profit: 940_000, avg_profit_rate: 39.2, count: 6,
  },
  by_part,
  by_team: { 'SW 기술교육팀': { cost_direct: 600_000, cost_labor: 120_000, cost_overhead: 60_000, cost_mgmt: 90_000, operating_profit: 500_000 } },
  monthly: [{ month: '1월', revenue: 100_000, cost: 40_000 }],
});

describe('buildPlanChartData 인당 차트(실적 보기와 같은 규칙, 27 계획 ÷ 인원)', () => {
  const data = buildPlanChartData(summary({
    '① AIㆍDS': part({ headcount: 4, rev_per_head: 300_000, profit_per_head: 117_500, mgmt_per_head: 20_000 }),
    '② SW':     part({ headcount: null }),                                   // 인원 미입력
    '⑦ K뉴딜TF': part({ headcount: 5, headcount_partial: true }),             // 팀 필터로 여러 팀에 걸침
  }))!;

  it('인당 값이 있는 파트만 막대로, 억 단위 소수 둘째 자리 버림', () => {
    expect(data.perCapita.labels).toEqual(['AIㆍDS']);
    expect(data.perCapita.revenue).toEqual([3]);       // 300,000천원 = 3.00억
    expect(data.perCapita.mgmt).toEqual([0.2]);
    expect(data.perCapita.profit).toEqual([1.17]);     // 1.175 → 둘째 자리 버림
  });

  it('제외된 파트는 이유별로 이름만 알려 준다(인원 미입력 / 팀 필터로 못 구함)', () => {
    expect(data.perCapita.missingParts).toEqual(['SW']);
    expect(data.perCapita.partialParts).toEqual(['K뉴딜TF']);
  });
});

describe('buildPlanChartData 구성 파이(전체·팀·파트)', () => {
  const data = buildPlanChartData(summary({ '① AIㆍDS': part({}), '② SW': part({ cost_direct: 200_000 }) }))!;

  it('조각 순서는 고정(직접원가·인건비·공통원가·관리비·경상손익) — 실적 보기 도넛과 같음', () => {
    expect(data.compositionPies.total.labels).toEqual(COMPOSITION_LABELS);
    expect(COMPOSITION_LABELS).toEqual(['직접원가', '인건비', '공통원가', '관리비', '경상손익']);
  });

  it('전체 / 팀 / 파트(원문자 뗀 이름) 값이 각각 억 단위로 들어 있다', () => {
    expect(data.compositionPies.total.values).toEqual([10, 2, 1, 1.6, 9.4]);
    expect(data.compositionPies.byTeam['SW 기술교육팀'].values).toEqual([6, 1.2, 0.6, 0.9, 5]);
    expect(data.compositionPies.byPart['SW'].values[0]).toBe(2);
    expect(data.compositionPies.byPart['AIㆍDS'].values[0]).toBe(5);
    expect(data.compositionPies.teams).toEqual(['SW 기술교육팀']);
  });
});

describe('buildPlanChartData 데이터가 없을 때', () => {
  it('요약이 없거나 y27이 없으면 null(화면은 빈 안내)', () => {
    expect(buildPlanChartData(undefined)).toBeNull();
    expect(buildPlanChartData({ ...summary({}), total: {} })).toBeNull();
  });
});
