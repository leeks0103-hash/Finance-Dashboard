import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

  it('opens an enlarged modal with the same title/body when the expand button is clicked', () => {
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

    fireEvent.click(within(dialog).getByLabelText('닫기'));
    expect(screen.queryByRole('dialog')).toBeNull();
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
