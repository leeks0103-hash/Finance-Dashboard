import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminExtractViewModel } from './useAdminExtractViewModel';
import type { useExtractJob } from '@/hooks/useExtractJob';

const confirm = vi.fn();
vi.mock('@/utils/dialog', () => ({ confirmDialog: (...a: unknown[]) => confirm(...a) }));

const makeJob = (over: Record<string, unknown> = {}) => ({
  isRunning: false, isStarting: false, status: undefined, run: vi.fn(), cancel: vi.fn(), ...over,
}) as unknown as ReturnType<typeof useExtractJob>;

beforeEach(() => { confirm.mockReset(); confirm.mockResolvedValue(true); });

describe('useAdminExtractViewModel — 추출 현황에서 선택 추출로 담기', () => {
  it('체크하면 방식이 선택으로 바뀌고 그 카드의 대상이 켜지며 파일이 담긴다', () => {
    const { result } = renderHook(() => useAdminExtractViewModel(makeJob()));
    // 시작은 증분, 재무·KPI 둘 다 켜짐 → KPI만 끄고 시작해 대상이 다시 켜지는지 본다
    act(() => result.current.toggleTarget('kpi'));
    expect(result.current.targets).toEqual(['finance']);

    act(() => result.current.pickFromCoverage(['a.pptx', 'b.pptx'], 'kpi', true));
    expect(result.current.mode).toBe('selected');
    expect(result.current.targets).toEqual(['finance', 'kpi']);
    expect(result.current.selectedFiles).toEqual(['a.pptx', 'b.pptx']);
  });

  it('같은 파일을 두 카드에서 담아도 한 번만 들어가고, 해제하면 빠진다(방식은 그대로)', () => {
    const { result } = renderHook(() => useAdminExtractViewModel(makeJob()));
    act(() => result.current.pickFromCoverage(['a.pptx'], 'finance', true));
    act(() => result.current.pickFromCoverage(['a.pptx', 'b.pptx'], 'kpi', true));
    expect(result.current.selectedFiles).toEqual(['a.pptx', 'b.pptx']);

    act(() => result.current.pickFromCoverage(['a.pptx'], 'finance', false));
    expect(result.current.selectedFiles).toEqual(['b.pptx']);
    expect(result.current.mode).toBe('selected');
  });

  it('추출 중에는 담지 않는다', () => {
    const { result } = renderHook(() => useAdminExtractViewModel(makeJob({ isRunning: true })));
    act(() => result.current.pickFromCoverage(['a.pptx'], 'finance', true));
    expect(result.current.selectedFiles).toEqual([]);
  });

  it('runSelected는 방식이 증분으로 바뀌어 있어도 항상 선택(files 포함)으로 보낸다', async () => {
    const job = makeJob();
    const { result } = renderHook(() => useAdminExtractViewModel(job));
    act(() => result.current.pickFromCoverage(['a.pptx'], 'finance', true));
    act(() => result.current.setMode('incremental'));

    await act(async () => { await result.current.runSelected(); });
    expect(job.run).toHaveBeenCalledWith({ targets: ['finance', 'kpi'], mode: 'selected', files: ['a.pptx'] });
  });

  it('확인창에서 취소하면 실행하지 않고, 담은 파일이 없으면 확인창도 안 띄운다', async () => {
    const job = makeJob();
    const { result } = renderHook(() => useAdminExtractViewModel(job));
    await act(async () => { await result.current.runSelected(); });
    expect(confirm).not.toHaveBeenCalled();

    act(() => result.current.pickFromCoverage(['a.pptx'], 'finance', true));
    confirm.mockResolvedValue(false);
    await act(async () => { await result.current.runSelected(); });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(job.run).not.toHaveBeenCalled();
  });
});
