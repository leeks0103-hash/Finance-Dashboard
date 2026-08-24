import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Toggle from './Toggle';
import styles from './Toggle.module.css';

const classList = (el: HTMLElement) => el.className.split(' ').filter(Boolean);

describe('Toggle', () => {
  it('has neither on nor dangerOn class when unchecked', () => {
    render(<Toggle checked={false} onChange={() => {}} />);
    const classes = classList(screen.getByRole('switch'));
    expect(classes).not.toContain(styles.on);
    expect(classes).not.toContain(styles.dangerOn);
  });

  it('applies .on when checked without danger', () => {
    render(<Toggle checked onChange={() => {}} />);
    expect(classList(screen.getByRole('switch'))).toContain(styles.on);
  });

  // 회귀 테스트 — danger=true일 때 .on 대신 .dangerOn이 붙어야 썸/라벨 스타일이 정상 적용됨
  it('applies .dangerOn instead of .on when checked with danger', () => {
    render(<Toggle checked danger onChange={() => {}} />);
    const classes = classList(screen.getByRole('switch'));
    expect(classes).toContain(styles.dangerOn);
    expect(classes).not.toContain(styles.on);
  });

  it('does not apply dangerOn when danger is true but unchecked', () => {
    render(<Toggle checked={false} danger onChange={() => {}} />);
    const classes = classList(screen.getByRole('switch'));
    expect(classes).not.toContain(styles.on);
    expect(classes).not.toContain(styles.dangerOn);
  });

  it('calls onChange when clicked', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reflects disabled state via aria and native attribute', () => {
    render(<Toggle checked={false} onChange={() => {}} disabled />);
    const el = screen.getByRole('switch');
    expect(el).toBeDisabled();
    expect(el).toHaveAttribute('aria-disabled', 'true');
  });

  it('exposes checked state via aria-checked', () => {
    render(<Toggle checked onChange={() => {}} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });
});
