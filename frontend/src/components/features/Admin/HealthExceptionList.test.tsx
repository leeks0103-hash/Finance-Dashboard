import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const state: { data: unknown } = { data: undefined };
const setMock = vi.fn().mockResolvedValue({ ok: true });
const confirmMock = vi.fn();

vi.mock('@/hooks/useDataHealth', () => ({
  useDataHealth: () => ({ data: state.data }),
  useDataHealthException: () => ({ pending: false, set: setMock }),
}));
vi.mock('@/utils/dialog', () => ({
  confirmDialog: (...a: unknown[]) => confirmMock(...a),
  alertDialog: vi.fn(),
}));

import HealthExceptionList from './HealthExceptionList';

const item = {
  file: '(그룹사 기아) 기아직속 상품조직_착수_SW.pptx',
  issues: ['KPI↔재무 코드 불일치: 재무 E1, E2 / KPI E1'],
  by: '관리자', at: '2026-11-10 10:00:00',
};

describe('HealthExceptionList', () => {
  beforeEach(() => { setMock.mockClear(); confirmMock.mockReset(); });

  it('예외 처리한 게 없으면 아무것도 안 그림', () => {
    state.data = { excepted: [] };
    const { container } = render(<HealthExceptionList />);
    expect(container).toBeEmptyDOMElement();
    state.data = undefined;
    expect(render(<HealthExceptionList />).container).toBeEmptyDOMElement();
  });

  it('데이터(이상 내용)와 "관리자 예외 처리 (임시)"·처리한 사람/시각을 보여 줌', () => {
    state.data = { excepted: [item] };
    render(<HealthExceptionList />);
    expect(screen.getByText(/예외 처리한 데이터 이상 · 1건/)).toBeInTheDocument();
    expect(screen.getByText(item.file)).toBeInTheDocument();
    expect(screen.getByText('관리자 예외 처리 (임시)')).toBeInTheDocument();
    expect(screen.getByText(/재무 E1, E2 \/ KPI E1/)).toBeInTheDocument();
    expect(screen.getByText(/관리자 · 2026-11-10 10:00 처리/)).toBeInTheDocument();
  });

  it('해제는 확인창에서 확인해야 서버에 요청', async () => {
    state.data = { excepted: [item] };
    render(<HealthExceptionList />);
    confirmMock.mockResolvedValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: '해제' }));
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1));
    expect(setMock).not.toHaveBeenCalled();
    confirmMock.mockResolvedValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: '해제' }));
    await waitFor(() => expect(setMock).toHaveBeenCalledWith([item.file], false));
  });
});
