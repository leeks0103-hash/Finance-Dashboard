import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useUiStore } from '@/store';
import AdminQuickActions from './AdminQuickActions';

// 창 본문은 이 테스트의 관심사가 아님(누가 보이고 무엇이 열리는지만)
vi.mock('./PartHeadcountModal', () => ({
  default: ({ initialKind }: { initialKind?: string }) => <div>인원 창 {initialKind ?? 'cur'}</div>,
}));

beforeEach(() => { useUiStore.setState({ adminAuthed: false }); });

describe('AdminQuickActions — 인원 카드 오른쪽 끝 [인원 입력]', () => {
  it('관리자가 아니면 아무것도 안 그린다(인원은 관리자만 고칠 수 있음)', () => {
    const { container } = render(<AdminQuickActions />);
    expect(container).toBeEmptyDOMElement();
  });

  it('관리자에겐 [인원 입력] 버튼이 보이고 누르면 인원 창이 열린다', () => {
    useUiStore.setState({ adminAuthed: true });
    render(<AdminQuickActions />);
    expect(screen.queryByText(/인원 창/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '인원 입력' }));
    expect(screen.getByText('인원 창 cur')).toBeInTheDocument();
  });

  it('2027 계획 보기 카드에서는 인원 입력 창이 2027 인원 탭으로 열린다', () => {
    useUiStore.setState({ adminAuthed: true });
    render(<AdminQuickActions headcountKind="y27" />);
    fireEvent.click(screen.getByRole('button', { name: '인원 입력' }));
    expect(screen.getByText('인원 창 y27')).toBeInTheDocument();
  });
});
