import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

// 실제 캔버스를 그릴 필요 없이 BarChart가 Chart.js에 넘기는 데이터만 본다
let captured: { data: { datasets: Record<string, unknown>[] } } | null = null;
vi.mock('react-chartjs-2', () => ({
  Bar: (props: { data: { datasets: Record<string, unknown>[] } }) => { captured = props; return <div data-testid="bar" />; },
}));

import BarChart from './BarChart';

const radii = () => captured!.data.datasets.map(d => d.borderRadius);

beforeEach(() => { captured = null; });

describe('BarChart 막대 모서리 — 세로는 전부 둥글게, 가로는 각 차트 설정 그대로 (2026-11-06)', () => {
  it('세로 그룹형 막대는 모든 막대가 둥글다 — 예전에 각지게(0)·미지정이던 것도 같이', () => {
    render(<BarChart labels={['a']} datasets={[
      { label: '매출', data: [1], borderRadius: 0 },     // KPI 차트가 예전에 각지게 지정하던 값
      { label: '원가', data: [2] },                        // 미지정(예전엔 각진 막대)
    ]} />);
    expect(radii()).toEqual([4, 4]);
  });

  it('누적 막대는 묶음의 맨 위 층만 둥글다 — 층마다 둥글면 층 사이가 파임', () => {
    render(<BarChart labels={['a']}
      options={{ scales: { x: { stacked: true }, y: { stacked: true } } }}
      datasets={[
        { label: '매출', data: [10], stack: 'rev' },
        { label: '직접원가', data: [5], stack: 'cost' },
        { label: '공통원가', data: [1], stack: 'cost' },
      ]} />);
    expect(radii()).toEqual([4, 0, 4]);   // 매출(혼자 한 묶음)·공통원가(원가 묶음의 맨 위)만
  });

  it('가로 막대(prop)는 건드리지 않는다 — 각 차트가 정한 모서리 그대로', () => {
    render(<BarChart horizontal labels={['a']} datasets={[
      { label: 'x', data: [1], borderRadius: 0 },
      { label: 'y', data: [2] },
    ]} />);
    expect(radii()).toEqual([0, undefined]);
  });

  it('options로 indexAxis: "y"만 넘기는 가로 차트(KPI)도 건드리지 않는다', () => {
    render(<BarChart labels={['a']} options={{ indexAxis: 'y' }} datasets={[{ label: 'x', data: [1], borderRadius: 0 }]} />);
    expect(radii()).toEqual([0]);
  });

  it('목표선 같은 line 데이터셋은 그대로 둔다', () => {
    render(<BarChart labels={['a']} datasets={[
      { label: '매출', data: [1] },
      { type: 'line', label: '목표', data: [1] },
    ]} />);
    expect(radii()).toEqual([4, undefined]);
  });
});
