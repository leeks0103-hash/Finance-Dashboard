import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnFilterPopover, describeColumnFilter } from './ColumnFilterPopover';
import { perfColumnSet, perfPlanColumnSet } from '@/components/features/PerformanceTable/columns';
import type { ColumnFilterSpec, ColumnFilterValue } from '@/types/columnFilter.types';

const costSpec: ColumnFilterSpec = {
  type: 'number', unit: 'eok',
  flags: [{ id: 'mismatch', label: '상이만 보기' }, { id: 'over_start', label: '착수↑만 보기' }],
};

const open = (spec: ColumnFilterSpec, value?: ColumnFilterValue) => {
  const onApply = vi.fn();
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  render(<ColumnFilterPopover anchor={anchor} colId="est_cost" title="당월 추정 직접원가"
    spec={spec} value={value} onApply={onApply} onClose={() => {}} />);
  return onApply;
};

describe('ColumnFilterPopover — 재무 대조 체크박스', () => {
  it('flags가 없는 숫자 필터에는 체크박스가 없음', () => {
    open({ type: 'number', unit: 'eok' });
    expect(screen.queryByRole('group', { name: '재무 대조 필터' })).not.toBeInTheDocument();
  });

  it('스펙의 체크박스를 보여 주고, 체크한 것만 flags로 내보냄', () => {
    const onApply = open(costSpec);
    expect(screen.getByLabelText('상이만 보기')).not.toBeChecked();
    fireEvent.click(screen.getByLabelText('착수↑만 보기'));
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(onApply).toHaveBeenCalledWith({ id: 'est_cost', type: 'number', unit: 'eok', min: null, max: null, flags: ['over_start'] });
  });

  it('둘 다 체크하면 스펙 순서대로, 범위와 함께', () => {
    const onApply = open(costSpec);
    fireEvent.click(screen.getByLabelText('착수↑만 보기'));
    fireEvent.click(screen.getByLabelText('상이만 보기'));
    fireEvent.change(screen.getByPlaceholderText('예: 2.1'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(onApply).toHaveBeenCalledWith({
      id: 'est_cost', type: 'number', unit: 'eok', min: 1, max: null, flags: ['mismatch', 'over_start'],
    });
  });

  it('범위도 체크도 없으면 필터 해제(null), 체크 안 했을 땐 flags 키 자체가 없음', () => {
    const onApply = open(costSpec);
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(onApply).toHaveBeenCalledWith(null);

    const onApply2 = open(costSpec);
    fireEvent.change(screen.getAllByPlaceholderText('예: 2.1')[1], { target: { value: '3' } });
    fireEvent.click(screen.getAllByRole('button', { name: '적용' })[1]);
    expect(onApply2).toHaveBeenCalledWith({ id: 'est_cost', type: 'number', unit: 'eok', min: 3, max: null });
  });

  it('걸려 있던 체크는 다시 열면 체크된 채로, 스펙에 없는 옛 id는 버림', () => {
    const onApply = open(costSpec, { id: 'est_cost', type: 'number', unit: 'eok', min: null, max: null, flags: ['mismatch', 'old'] });
    expect(screen.getByLabelText('상이만 보기')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(onApply).toHaveBeenCalledWith({ id: 'est_cost', type: 'number', unit: 'eok', min: null, max: null, flags: ['mismatch'] });
  });
});

describe('describeColumnFilter — flags', () => {
  const labels = { mismatch: '상이만 보기', over_start: '착수↑만 보기' };
  const base = { id: 'est_cost', type: 'number', unit: 'eok' } as const;

  it('범위 + 체크', () => {
    expect(describeColumnFilter({ ...base, min: 2, max: null, flags: ['mismatch', 'over_start'] }, '직접원가', labels))
      .toBe('직접원가 ≥ 2억 · 상이만 보기, 착수↑만 보기');
  });
  it('체크만 있으면 제목: 체크', () => {
    expect(describeColumnFilter({ ...base, min: null, max: null, flags: ['over_start'] }, '직접원가', labels))
      .toBe('직접원가: 착수↑만 보기');
  });
  it('라벨을 모르는 id는 id 그대로, flags 없으면 예전과 같음', () => {
    expect(describeColumnFilter({ ...base, min: null, max: null, flags: ['x'] }, 'T')).toBe('T: x');
    expect(describeColumnFilter({ ...base, min: 1, max: 2 }, 'T')).toBe('T: 1~2억');
  });
});

describe('실적 표 열 정의 — 체크박스 위치', () => {
  const flagsOf = (cols: ReturnType<typeof perfColumnSet>['columns']) => {
    const out: Record<string, string[] | undefined> = {};
    for (const c of cols) {
      const x = c as { id?: string; accessorKey?: string; meta?: { filter?: { flags?: readonly { id: string }[] } } };
      const id = x.id ?? x.accessorKey ?? '';
      if (id === 'jun_check_total' || id === 'est_cost') out[id] = x.meta?.filter?.flags?.map(f => f.id);
    }
    return out;
  };

  it('실적 보기: 매출은 상이, 직접원가는 상이·착수↑', () => {
    expect(flagsOf(perfColumnSet('9월').columns)).toEqual({
      jun_check_total: ['mismatch'],
      est_cost: ['mismatch', 'over_start'],
    });
  });

  it('계획 보기엔 재무 대조가 없어 체크박스도 없음', () => {
    expect(flagsOf(perfPlanColumnSet().columns)).toEqual({ jun_check_total: undefined, est_cost: undefined });
  });
});
