import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import KpiAnomalyAdmin from './KpiAnomalyAdmin';
import type { KpiAnomaly, KpiAnomalyExcepted } from '@/types/kpi.types';

const item: KpiAnomaly = {
  id: 'a.pptx|E1|추가', project_code: 'E1', stage: '추가', file: 'a.pptx',
  metrics: [{ metric: 'NPS', value: '4.5' }, { metric: 'AI활용', value: '10' }, { metric: 'AI적용', value: '3' }],
};
const excepted: KpiAnomalyExcepted = { ...item, id: 'b.pptx|E2|추가', project_code: 'E2', file: 'b.pptx', by: '관리자', at: '2026-11-11 09:00:00' };

describe('KpiAnomalyAdmin', () => {
  it('지표가 3개여도 프로젝트 한 건은 한 줄로 보여 줌', () => {
    render(<KpiAnomalyAdmin items={[item]} showItems excepted={[]} pending={false} onExcept={() => {}} />);
    expect(screen.getByText(/의심 항목 · 1건/)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText(/지표 3개 — NPS 4.5 · AI활용 10 · AI적용 3/)).toBeInTheDocument();
  });

  it('[예외 처리]·[해제]는 그 건을 넘겨 호출', () => {
    const onExcept = vi.fn();
    render(<KpiAnomalyAdmin items={[item]} showItems excepted={[excepted]} pending={false} onExcept={onExcept} />);
    fireEvent.click(screen.getByRole('button', { name: '예외 처리' }));
    expect(onExcept).toHaveBeenLastCalledWith(item, true);
    fireEvent.click(screen.getByRole('button', { name: '해제' }));
    expect(onExcept).toHaveBeenLastCalledWith(excepted, false);
    expect(screen.getByText('관리자 예외 처리 (임시)')).toBeInTheDocument();
    expect(screen.getByText(/관리자 · 2026-11-11 09:00 처리/)).toBeInTheDocument();
  });

  it('배너가 숨겨져 있어도 예외 처리한 건은 해제할 수 있게 보임', () => {
    render(<KpiAnomalyAdmin items={[item]} showItems={false} excepted={[excepted]} pending={false} onExcept={() => {}} />);
    expect(screen.queryByText(/의심 항목/)).toBeNull();
    expect(screen.getByRole('button', { name: '해제' })).toBeInTheDocument();
  });

  it('둘 다 없으면 아무것도 안 그림', () => {
    const { container } = render(<KpiAnomalyAdmin items={[]} showItems excepted={[]} pending={false} onExcept={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
