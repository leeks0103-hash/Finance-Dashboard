import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { ChartCard } from './ChartCard';
import styles from './ChartCard.module.css';

describe('ChartCard', () => {
  it('renders title inside the bordered card with titleCompact styling by default', () => {
    const { container } = render(
      <ChartCard>
        <ChartCard.Title>제목</ChartCard.Title>
        <ChartCard.Body>내용</ChartCard.Body>
      </ChartCard>,
    );

    const root = container.querySelector(`.${styles.root}`);
    expect(root).not.toBeNull();
    // compact 제목은 .root(테두리 박스) 안에 있어야 함
    expect(root?.querySelector(`.${styles.titleCompact} .${styles.titleContent}`)?.textContent).toBe('제목');
    expect(screen.getByText('내용')).toBeInTheDocument();
  });

  it('opens an enlarged modal with the same title/body when the expand button is clicked', async () => {
    render(
      <ChartCard>
        <ChartCard.Title>제목</ChartCard.Title>
        <ChartCard.Body>내용</ChartCard.Body>
      </ChartCard>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByLabelText('차트 확대'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('제목')).toBeInTheDocument();
    expect(within(dialog).getByText('내용')).toBeInTheDocument();

    // 닫기는 퇴장 애니메이션(useAnimatedClose) 뒤에 실제로 사라짐
    fireEvent.click(within(dialog).getByLabelText('닫기'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('확대 모달이 열리면 포커스가 패널로 옮겨지고 Tab이 모달 밖으로 나가지 않는다(2026-11-04, QA UI M5)', () => {
    render(
      <div>
        <button type="button">모달 밖 버튼</button>
        <ChartCard>
          <ChartCard.Title>제목</ChartCard.Title>
          <ChartCard.Body>내용</ChartCard.Body>
        </ChartCard>
      </div>,
    );
    fireEvent.click(screen.getByLabelText('차트 확대'));
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);

    // 마지막 포커스 가능 요소(닫기)에서 Tab → 첫 요소로 순환(모달 안), Shift+Tab은 반대
    const close = within(dialog).getByLabelText('닫기');
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('hides the expand button when expandable={false}', () => {
    render(
      <ChartCard expandable={false}>
        <ChartCard.Title>제목</ChartCard.Title>
        <ChartCard.Body>내용</ChartCard.Body>
      </ChartCard>,
    );
    expect(screen.queryByLabelText('차트 확대')).toBeNull();
  });

  it('renders title outside the bordered card when compact={false}', () => {
    const { container } = render(
      <ChartCard compact={false}>
        <ChartCard.Title>제목</ChartCard.Title>
        <ChartCard.Body>내용</ChartCard.Body>
      </ChartCard>,
    );

    const root = container.querySelector(`.${styles.root}`);
    // non-compact 제목은 .root 바깥에 있어야 하고, 안에는 없어야 함
    expect(root?.querySelector(`.${styles.title}`)).toBeNull();
    const outerTitle = container.querySelector(`.${styles.title}`);
    expect(outerTitle?.querySelector(`.${styles.titleContent}`)?.textContent).toBe('제목');
    expect(root?.contains(outerTitle)).toBe(false);
  });

  it('always wraps in the group container regardless of compact mode (100% height sizing)', () => {
    const compact = render(
      <ChartCard>
        <ChartCard.Title>A</ChartCard.Title>
        <ChartCard.Body>B</ChartCard.Body>
      </ChartCard>,
    );
    expect(compact.container.querySelector(`.${styles.group}`)).not.toBeNull();

    const nonCompact = render(
      <ChartCard compact={false}>
        <ChartCard.Title>A</ChartCard.Title>
        <ChartCard.Body>B</ChartCard.Body>
      </ChartCard>,
    );
    expect(nonCompact.container.querySelector(`.${styles.group}`)).not.toBeNull();
  });
});
