import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal 포커스(2026-10-27)', () => {
  it('열리면 포커스가 모달 패널로 옮겨진다 — 모달을 연 버튼에 포커스가 남아 ESC 후 테두리가 뜨는 것을 막음', () => {
    render(
      <>
        <button>열기</button>
        <Modal title="제목" onClose={() => {}}><p>본문</p></Modal>
      </>,
    );
    screen.getByText('열기').focus();
    // 위에서 직접 포커스를 줬어도, 모달이 막 열릴 때의 포커스는 패널이어야 함 — 새로 그려 확인
    const { unmount } = render(<Modal title="다른 제목" onClose={() => {}}><p>x</p></Modal>);
    const dialogs = screen.getAllByRole('dialog');
    expect(document.activeElement).toBe(dialogs[dialogs.length - 1]);
    unmount();
  });

  it('모달 안 입력칸이 이미 포커스를 가졌으면 패널이 빼앗지 않는다', () => {
    render(<Modal title="입력" onClose={() => {}}><input aria-label="이름" autoFocus /></Modal>);
    expect(document.activeElement).toBe(screen.getByLabelText('이름'));
  });
});
