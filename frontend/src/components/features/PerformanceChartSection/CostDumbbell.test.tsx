import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CostDumbbell, { type DumbbellRow, type DumbbellColors } from './CostDumbbell';

const colors: DumbbellColors = {
  revenue: '#001', direct: '#002', overhead: '#003', gain: '#004', loss: '#005', rate: '#009', label: '#006', tick: '#007', grid: '#008',
};
const rows: DumbbellRow[] = [
  { part: 'PM', revenue: 22.8, direct: 11.9, overhead: 0.6 },
  { part: 'K뉴딜TF', revenue: 30.2, direct: 29.4, overhead: 1.9 },   // 원가 31.3 > 매출 30.2 → 손실
];

describe('CostDumbbell', () => {
  it('직접원가 + 공통원가 = 총원가, 매출, 이익·원가율을 숫자로 보여 줌', () => {
    render(<CostDumbbell rows={rows} colors={colors} />);
    expect(screen.getAllByTestId('dumbbell-row')).toHaveLength(2);
    expect(screen.getByText('22.8')).toBeInTheDocument();                          // 매출
    expect(screen.getByText(/\) = 12\.5/)).toBeInTheDocument();                    // 총원가(직접 + 공통)
    expect(screen.getByText('이익 +10.3')).toBeInTheDocument();
    expect(screen.getByText('원가율 54.8%')).toBeInTheDocument();
  });

  it('이익(초록)과 원가율(기존 원가율 색)은 글자색이 다름', () => {
    render(<CostDumbbell rows={rows} colors={colors} />);
    expect(screen.getByText('이익 +10.3')).toHaveAttribute('fill', colors.gain);
    expect(screen.getByText('원가율 54.8%')).toHaveAttribute('fill', colors.rate);
    expect(screen.getByText('손실 −1.1')).toHaveAttribute('fill', colors.loss);
  });

  it('원가가 매출을 넘으면 손실색 선·손실 문구', () => {
    render(<CostDumbbell rows={rows} colors={colors} />);
    expect(screen.getByText('손실 −1.1')).toBeInTheDocument();
    expect(screen.getByText('원가율 103.6%')).toBeInTheDocument();
    const gaps = screen.getAllByTestId('dumbbell-gap');
    expect(gaps[0]).toHaveAttribute('stroke', colors.gain);
    expect(gaps[1]).toHaveAttribute('stroke', colors.loss);
  });

  it('그래프 수치를 끄면 숫자 글씨는 빠지고 파트명·점은 남음', () => {
    render(<CostDumbbell rows={rows} colors={colors} showLabels={false} />);
    expect(screen.queryByText('22.8')).not.toBeInTheDocument();
    expect(screen.queryByText('이익 +10.3')).not.toBeInTheDocument();
    expect(screen.getByText('PM')).toBeInTheDocument();
    expect(screen.getAllByTestId('dumbbell-row')).toHaveLength(2);
  });

  it('클릭: 파트명 -1(숨김 토글)·매출 점 0·직접원가 1 — 막대 차트의 datasetIndex와 같은 뜻', () => {
    const onSelect = vi.fn();
    const { container } = render(<CostDumbbell rows={[rows[0]]} colors={colors} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('PM'));
    fireEvent.click(container.querySelector('circle')!);
    fireEvent.click(container.querySelector('g[clip-path] rect')!);
    expect(onSelect.mock.calls).toEqual([['PM', -1], ['PM', 0], ['PM', 1]]);
  });

  it('선 색은 막대 차트와 같음 — 눈금선은 공용 gridColor, 축선은 Chart.js 기본 테두리색', () => {
    render(<CostDumbbell rows={rows} colors={colors} />);
    for (const g of screen.getAllByTestId('dumbbell-grid')) expect(g).toHaveAttribute('stroke', colors.grid);
    expect(screen.getByTestId('dumbbell-axis-y')).toHaveAttribute('stroke', 'rgba(0,0,0,0.1)');
    expect(screen.getByTestId('dumbbell-axis-x')).toHaveAttribute('stroke', 'rgba(0,0,0,0.1)');
  });

  it('grid 색을 안 주면 라이트 gridColor 값으로 그림', () => {
    const { grid: _unused, ...noGrid } = colors;
    void _unused;
    render(<CostDumbbell rows={rows} colors={noGrid} />);
    expect(screen.getAllByTestId('dumbbell-grid')[0]).toHaveAttribute('stroke', 'rgba(0,44,95,0.08)');
  });

  it('축선이 그래프 밖으로 튀어나가지 않음 — 눈금 표시 없음, 가로 축선은 마지막 눈금선 위치에서 끝', () => {
    const { container } = render(<CostDumbbell rows={rows} colors={colors} />);
    const grids = screen.getAllByTestId('dumbbell-grid');
    const lastGridX = Number(grids[grids.length - 1].getAttribute('x1'));
    const axisX = screen.getByTestId('dumbbell-axis-x');
    expect(Number(axisX.getAttribute('x2'))).toBeLessThanOrEqual(lastGridX + 1);
    const axisY = Number(axisX.getAttribute('y1'));
    // 가로 축선 아래로 내려가는 세로 선(눈금 표시)이 없어야 함
    const stubs = [...container.querySelectorAll('line')].filter(l => l.getAttribute('x1') === l.getAttribute('x2') && Number(l.getAttribute('y2')) > axisY + 1);
    expect(stubs).toHaveLength(0);
  });

  it('위쪽 가로선이 있어 그래프가 위로 뚫려 보이지 않음 — 막대 차트 맨 위 눈금선처럼 눈금선 색', () => {
    render(<CostDumbbell rows={rows} colors={colors} />);
    const top = screen.getByTestId('dumbbell-axis-top');
    expect(top).toHaveAttribute('stroke', colors.grid);
    expect(top.getAttribute('x1')).toBe(screen.getByTestId('dumbbell-axis-x').getAttribute('x1'));   // 아래 가로선과 같은 길이
    expect(top.getAttribute('x2')).toBe(screen.getByTestId('dumbbell-axis-x').getAttribute('x2'));
  });

  it('왼쪽 여백은 가장 긴 파트명 폭에 맞춤 — 글자 수 × 14px로 잡던 때는 K뉴딜TF에 108px', () => {
    render(<CostDumbbell rows={rows} colors={colors} />);
    const plotLeft = Number(screen.getByTestId('dumbbell-axis-y').getAttribute('x1'));
    expect(plotLeft).toBeLessThan(85);
    expect(plotLeft).toBeGreaterThanOrEqual(60);   // 파트명이 잘리지 않을 만큼은 있어야 함
  });

  it('행이 없어도 안 깨짐', () => {
    render(<CostDumbbell rows={[]} colors={colors} />);
    expect(screen.queryAllByTestId('dumbbell-row')).toHaveLength(0);
  });
});
