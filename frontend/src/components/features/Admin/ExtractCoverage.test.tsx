import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExtractCoverage from './ExtractCoverage';
import type { CoverageItem, SourceCoverage } from '@/types/extract.types';

const item = (file: string, over: Partial<CoverageItem> = {}): CoverageItem => ({
  file, status: 'extracted', rows: 1, reason: '', at: '2026-10-20 10:00', modified: false, modified_at: '', ...over,
});
const source = (label: string, items: CoverageItem[]): SourceCoverage => ({
  label, excel_ok: true, folder_files: items.length, rows_total: items.length, duplicate_names: 0, orphans: [],
  modified_count: items.filter(i => i.modified).length, items,
  counts: {
    extracted: items.filter(i => i.status === 'extracted').length, merged: 0, no_table: 0,
    failed: items.filter(i => i.status === 'failed').length, pending: items.filter(i => i.status === 'pending').length,
  },
});

const modifiedA = item('A_제안.pptx', { modified: true, modified_at: '2026-10-28 09:00' });
const modifiedB = item('B_착수.pptx', { modified: true, modified_at: '2026-10-28 09:10' });
const failed = item('C_완료.pptx', { status: 'failed', reason: '열지 못함' });
const fine = item('D_정상.pptx');

vi.mock('@/hooks/useExtractCoverage', () => ({
  useExtractCoverage: () => ({
    isLoading: false, isFetching: false, refresh: vi.fn(),
    data: {
      ok: true, scanned_at: '2026-10-29 17:00',
      finance: source('재무', [modifiedA, modifiedB, failed, fine]),
      kpi: source('KPI', [modifiedA]),
    },
  }),
}));
vi.mock('@/hooks/useOpenFile', () => ({ openCoverageFileOrAlert: vi.fn() }));

const renderCoverage = (props: Partial<Parameters<typeof ExtractCoverage>[0]> = {}) => {
  const onPick = vi.fn();
  const utils = render(<ExtractCoverage finishedAt={null} selectedFiles={[]} onPick={onPick} {...props} />);
  return { onPick, ...utils };
};

describe('ExtractCoverage — 목록에서 선택 추출에 담기', () => {
  it('실패·미처리·원본 수정됨 파일에만 체크박스가 붙고, 정상 파일엔 없다', () => {
    renderCoverage();
    expect(screen.getAllByRole('checkbox', { name: /A_제안\.pptx/ })).toHaveLength(2);   // 재무·KPI 카드에 한 번씩
    expect(screen.getByRole('checkbox', { name: /B_착수\.pptx/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /C_완료\.pptx/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /D_정상\.pptx/ })).toBeNull();
  });

  it('체크하면 그 카드의 대상(재무/KPI)과 함께 담는다', () => {
    const { onPick } = renderCoverage();
    fireEvent.click(screen.getByRole('checkbox', { name: /B_착수\.pptx/ }));
    expect(onPick).toHaveBeenCalledWith(['B_착수.pptx'], 'finance', true);
  });

  it('이미 담긴 파일은 체크돼 있고, 다시 누르면 뺀다', () => {
    const { onPick } = renderCoverage({ selectedFiles: ['B_착수.pptx'] });
    const box = screen.getByRole('checkbox', { name: /B_착수\.pptx/ });
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(onPick).toHaveBeenCalledWith(['B_착수.pptx'], 'finance', false);
  });

  it('"수정된 N개 모두 선택"은 그 카드의 원본 수정 파일만 한꺼번에 담는다', () => {
    const { onPick } = renderCoverage();
    fireEvent.click(screen.getByRole('button', { name: '수정된 2개 모두 선택' }));
    expect(onPick).toHaveBeenCalledWith(['A_제안.pptx', 'B_착수.pptx'], 'finance', true);
  });

  it('담긴 파일이 있으면 아래 바에서 개수를 보여 주고 바로 다시 추출·해제할 수 있다', () => {
    const onRunSelected = vi.fn();
    const onClearSelected = vi.fn();
    renderCoverage({ selectedFiles: ['A_제안.pptx', 'B_착수.pptx'], onRunSelected, onClearSelected });
    fireEvent.click(screen.getByRole('button', { name: '선택한 2개 다시 추출' }));
    expect(onRunSelected).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByRole('button', { name: '선택 해제' }).at(-1)!);
    expect(onClearSelected).toHaveBeenCalledTimes(1);
  });

  it('담긴 파일이 없으면 바가 없고, 추출 중(retryDisabled)이면 체크·바 버튼이 잠긴다', () => {
    const { rerender } = renderCoverage({ onRunSelected: vi.fn() });
    expect(screen.queryByRole('region', { name: '선택한 파일 다시 추출' })).toBeNull();
    rerender(<ExtractCoverage finishedAt={null} selectedFiles={['A_제안.pptx']} onPick={vi.fn()}
      onRunSelected={vi.fn()} retryDisabled />);
    expect(screen.getByRole('checkbox', { name: /C_완료\.pptx/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: '선택한 1개 다시 추출' })).toBeDisabled();
  });
});
