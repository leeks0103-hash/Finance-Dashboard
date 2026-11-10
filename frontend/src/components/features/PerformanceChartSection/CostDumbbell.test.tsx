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

  it('행이 없어도 안 깨짐', () => {
    render(<CostDumbbell rows={[]} colors={colors} />);
    expect(screen.queryAllByTestId('dumbbell-row')).toHaveLength(0);
  });
});
