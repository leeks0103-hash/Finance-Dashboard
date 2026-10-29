import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from './ui.store';

describe('ui.store 2027 계획 보기 안내 닫기(2026-10-29)', () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({ planNoteDismissed: false });
  });

  it('처음엔 안내가 보이고(닫지 않음), 닫으면 true로 바뀐다', () => {
    expect(useUiStore.getState().planNoteDismissed).toBe(false);
    useUiStore.getState().dismissPlanNote();
    expect(useUiStore.getState().planNoteDismissed).toBe(true);
  });

  it('닫은 상태는 이 브라우저(localStorage)에 저장돼 새로고침해도 유지된다', () => {
    useUiStore.getState().dismissPlanNote();
    const saved = JSON.parse(localStorage.getItem('ui-store') ?? '{}') as { state?: { planNoteDismissed?: boolean } };
    expect(saved.state?.planNoteDismissed).toBe(true);
  });
});
