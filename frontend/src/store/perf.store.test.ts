import { describe, it, expect, beforeEach } from 'vitest';
import { usePerfStore } from './perf.store';

describe('perf.store 보기(perfView, 2026-10-29)', () => {
  beforeEach(() => {
    localStorage.clear();
    usePerfStore.setState({ perfView: 'actual', selectedParts: [], selectedTeam: '', initialized: false });
  });

  it('기본은 2026 실적 보기', () => {
    expect(usePerfStore.getState().perfView).toBe('actual');
  });

  it('setPerfView로 2027 계획으로 바꾸면 팀·파트 선택은 그대로 둔다', () => {
    usePerfStore.getState().setTeam('SW 기술교육팀', ['AIㆍDS', 'SW']);
    usePerfStore.getState().setPerfView('plan27');
    const s = usePerfStore.getState();
    expect(s.perfView).toBe('plan27');
    expect(s.selectedTeam).toBe('SW 기술교육팀');
    expect(s.selectedParts).toEqual(['AIㆍDS', 'SW']);
  });

  it('팀·파트 필터 초기화(reset)는 보기를 건드리지 않는다', () => {
    usePerfStore.getState().setPerfView('plan27');
    usePerfStore.getState().reset();
    expect(usePerfStore.getState().perfView).toBe('plan27');
  });

  it('보기도 팀·파트 필터와 같이 저장된다(새로고침 후에도 유지)', () => {
    usePerfStore.getState().setPerfView('plan27');
    const saved = JSON.parse(localStorage.getItem('perf-filter-store') ?? '{}');
    expect(saved.state.perfView).toBe('plan27');
  });
});
