import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useUiStore } from '@/store';
import CostChartSwitch from './CostChartSwitch';

const el = <CostChartSwitch bars={<div>막대 차트</div>} dumbbell={<div>덤벨 차트</div>} />;

describe('CostChartSwitch', () => {
  beforeEach(() => useUiStore.setState({ adminAuthed: false, costView: 'bars' }));

  it('일반 사용자는 저장된 값과 상관없이 항상 막대, 토글 없음', () => {
    useUiStore.setState({ costView: 'dumbbell' });
    render(el);
    expect(screen.getByText('막대 차트')).toBeInTheDocument();
    expect(screen.queryByText('덤벨 차트')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '덤벨' })).not.toBeInTheDocument();
  });

  it('관리자는 토글로 막대/덤벨을 고르고 고른 값이 저장됨', () => {
    useUiStore.setState({ adminAuthed: true });
    render(el);
    expect(screen.getByText('막대 차트')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '덤벨' }));
    expect(screen.getByText('덤벨 차트')).toBeInTheDocument();
    expect(useUiStore.getState().costView).toBe('dumbbell');
    fireEvent.click(screen.getByRole('button', { name: '막대' }));
    expect(screen.getByText('막대 차트')).toBeInTheDocument();
  });

  it('저장값이 이상하면 막대', () => {
    useUiStore.setState({ adminAuthed: true, costView: 'weird' as never });
    render(el);
    expect(screen.getByText('막대 차트')).toBeInTheDocument();
  });
});
