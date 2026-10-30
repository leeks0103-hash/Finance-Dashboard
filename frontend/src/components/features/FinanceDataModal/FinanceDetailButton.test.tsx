import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FinanceDetailButton from './FinanceDetailButton';

// 모달 본문(재무 표)은 이 테스트의 관심사가 아님 — 열리고 닫히는지만
vi.mock('./FinanceDataModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => <div>재무 상세 창<button type="button" onClick={onClose}>닫기</button></div>,
}));

describe('FinanceDetailButton — 프로젝트 상세 제목줄의 재무 상세 버튼', () => {
  it('누르면 프로젝트 재무 상세 창이 열리고 닫으면 사라진다', () => {
    render(<FinanceDetailButton />);
    expect(screen.queryByText('재무 상세 창')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '재무 상세' }));
    expect(screen.getByText('재무 상세 창')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByText('재무 상세 창')).toBeNull();
  });
});
