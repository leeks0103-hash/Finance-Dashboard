import { describe, it, expect, vi } from 'vitest';
import { buildServerPagination, buildServerSearch } from './serverTableProps';
import type { UseReactPaginationResult } from '@/lib/pagination';
import type { DebouncedSearch } from '@/hooks/useDebouncedSearch';

const pagination = () => ({
  page: 2, pageSize: 20, setPage: vi.fn(), setPageSize: vi.fn(), resetToFirstPage: vi.fn(),
}) as unknown as UseReactPaginationResult;

describe('buildServerPagination', () => {
  it('페이지 상태와 전체 건수를 표 props 모양으로 묶는다', () => {
    const p = pagination();
    const r = buildServerPagination(p, 95);
    expect(r).toMatchObject({ total: 95, page: 2, pageSize: 20 });
    r.onPageChange(3);
    r.onPageSizeChange(50);
    expect(p.setPage).toHaveBeenCalledWith(3);
    expect(p.setPageSize).toHaveBeenCalledWith(50);
  });
});

describe('buildServerSearch', () => {
  const search = () => ({ inputValue: 'abc', handleChange: vi.fn() }) as unknown as DebouncedSearch;
  const options = [{ value: '', label: '전체' }];

  it('검색어를 바꾸면 입력 처리 후 1페이지로 돌아간다', () => {
    const s = search(); const p = pagination();
    const r = buildServerSearch(s, p, '', vi.fn(), options);
    expect(r.value).toBe('abc');
    r.onChange('xyz');
    expect(s.handleChange).toHaveBeenCalledWith({ target: { value: 'xyz' } });
    expect(p.resetToFirstPage).toHaveBeenCalled();
  });

  it('검색 범위를 바꾸면 범위 저장 후 1페이지로 돌아간다', () => {
    const setField = vi.fn(); const p = pagination();
    const r = buildServerSearch(search(), p, 'name', setField, options);
    expect(r.field).toBe('name');
    expect(r.fieldOptions).toBe(options);
    r.onFieldChange('code');
    expect(setField).toHaveBeenCalledWith('code');
    expect(p.resetToFirstPage).toHaveBeenCalled();
  });
});
