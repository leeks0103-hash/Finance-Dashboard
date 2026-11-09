import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUiStore } from '@/store';

let anomalyCount = 3;
const useKpiDataPaged = vi.fn();
vi.mock('@/hooks/useKpiSummary', () => ({
  useKpiSummary: () => ({
    data: { available: true, items: [], anomaly_count: anomalyCount, anomalies: [] },
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useKpiDataPaged: (...a: unknown[]) => { useKpiDataPaged(...a); return { data: { rows: [], total: 0 }, isLoading: false, isFetching: false }; },
}));

let visible = true;
const updateVisibility = vi.fn();
vi.mock('@/hooks/useVisibility', () => ({
  useVisible: () => visible,
  useVisibilitySettings: () => ({ update: updateVisibility }),
}));

const confirmDialog = vi.fn();
vi.mock('@/utils/dialog', () => ({ confirmDialog: (...a: unknown[]) => confirmDialog(...a) }));

import { useKpiPageViewModel } from './useKpiPageViewModel';

beforeEach(() => {
  anomalyCount = 3;
  visible = true;
  useKpiDataPaged.mockClear();
  updateVisibility.mockClear();
  confirmDialog.mockReset().mockResolvedValue(true);
  useUiStore.setState({ adminAuthed: false });
});

describe('KPI 조기입력 의심 안내 — 관리자가 닫으면 모두에게 숨김, 공개 범위에서 다시 켬 (2026-11-09)', () => {
  it('공개 범위가 열려 있고 의심 행이 있으면 배너를 보여 준다', () => {
    const { result } = renderHook(() => useKpiPageViewModel());
    expect(result.current.showAnomalyNotice).toBe(true);
    expect(result.current.anomalyCount).toBe(3);
  });

  it('의심 행이 0건이면 안 보여 준다', () => {
    anomalyCount = 0;
    expect(renderHook(() => useKpiPageViewModel()).result.current.showAnomalyNotice).toBe(false);
  });

  it('공개 범위가 숨김(닫힘)이면 의심 행이 있어도 안 보여 준다 — 일반 사용자뿐 아니라 모두', () => {
    visible = false;
    expect(renderHook(() => useKpiPageViewModel()).result.current.showAnomalyNotice).toBe(false);
  });

  it('닫기(×)는 관리자에게만 — 모든 사람 화면에 영향을 주는 동작이라', () => {
    expect(renderHook(() => useKpiPageViewModel()).result.current.canCloseAnomalyNotice).toBe(false);
    useUiStore.setState({ adminAuthed: true });
    expect(renderHook(() => useKpiPageViewModel()).result.current.canCloseAnomalyNotice).toBe(true);
  });

  it('닫기 — 확인창에서 닫기를 고르면 공개 범위를 숨김(none)으로 저장', async () => {
    useUiStore.setState({ adminAuthed: true });
    const { result } = renderHook(() => useKpiPageViewModel());
    await result.current.closeAnomalyNotice();
    expect(confirmDialog).toHaveBeenCalledTimes(1);
    expect(String(confirmDialog.mock.calls[0][0])).toContain('모든 사람에게 보이지 않습니다');
    expect(updateVisibility).toHaveBeenCalledWith({ kpiAnomaly: 'none' });
  });

  it('닫기 — 확인창에서 취소하면 아무것도 바꾸지 않는다', async () => {
    confirmDialog.mockResolvedValue(false);
    useUiStore.setState({ adminAuthed: true });
    const { result } = renderHook(() => useKpiPageViewModel());
    await result.current.closeAnomalyNotice();
    expect(updateVisibility).not.toHaveBeenCalled();
  });

  it('배너가 숨겨지면 "한눈에 보기" 필터도 풀린다 — 안 풀리면 [전체 보기] 버튼 없이 표가 의심 행만 보여 줌', () => {
    renderHook(() => useKpiPageViewModel('', true));
    expect(useKpiDataPaged.mock.calls.at(-1)![2]).toBe(true);      // 배너가 보일 땐 필터 유지

    visible = false;
    renderHook(() => useKpiPageViewModel('', true));
    expect(useKpiDataPaged.mock.calls.at(-1)![2]).toBe(false);     // 닫힌 뒤엔 풀림
  });
});
