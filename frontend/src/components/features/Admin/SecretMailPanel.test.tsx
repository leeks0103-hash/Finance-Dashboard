import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SecretMailPanel from './SecretMailPanel';
import type { SecretMailRoster } from '@/types/secretMail.types';

const roster: SecretMailRoster = {
  ok: true, file: '명단.xlsx', subject: '접속 안내', sender: 'admin@example.com', sender_error: null,
  job: { running: false },
  rows: [
    { emp: '1001', name: '홍길동', mail: 'hong@example.com', excluded: false, key_ok: true, sent_at: null },
    { emp: '1002', name: '김철수', mail: 'kim@example.com', excluded: false, key_ok: true, sent_at: '2026-10-20 10:00:00' },
  ],
};

const useSecretMail = vi.fn();
vi.mock('@/hooks/useSecretMail', () => ({
  useSecretMail: (enabled: boolean) => useSecretMail(enabled),
  useSecretMailAccountDiff: () => ({ isLoading: false, isFetching: false, error: null, data: undefined, refetch: vi.fn() }),
}));
vi.mock('./SecretMailPreviewModal', () => ({ default: () => <div>미리보기 창</div> }));

beforeEach(() => {
  useSecretMail.mockReset();
  useSecretMail.mockReturnValue({
    data: roster, isLoading: false, loadError: null, refetch: vi.fn(), job: roster.job, running: false,
    start: vi.fn(), isStarting: false, startError: null, cancel: vi.fn(), isCancelling: false,
  });
});

describe('SecretMailPanel', () => {
  it('기본(버튼 → 모달)은 "명단 보기"를 누르기 전엔 명단을 안 읽고 안 보여 준다', () => {
    render(<SecretMailPanel />);
    expect(useSecretMail).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText('홍길동')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '명단 보기' }));
    expect(useSecretMail).toHaveBeenLastCalledWith(true);
    expect(screen.getByText('홍길동')).toBeInTheDocument();
  });

  it('inline(관리자 창 탭)은 버튼 없이 처음부터 명단·보내기 버튼을 보여 주고 바로 읽는다', () => {
    render(<SecretMailPanel inline />);
    expect(useSecretMail).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole('button', { name: '명단 보기' })).toBeNull();
    expect(screen.getByText('홍길동')).toBeInTheDocument();
    expect(screen.getByText('김철수')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '메일 미리보기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /전체 보내기/ })).toBeInTheDocument();
  });

  it('inline에서도 미리보기는 따로 창으로 열린다', () => {
    render(<SecretMailPanel inline />);
    fireEvent.click(screen.getByRole('button', { name: '메일 미리보기' }));
    expect(screen.getByText('미리보기 창')).toBeInTheDocument();
  });
});
