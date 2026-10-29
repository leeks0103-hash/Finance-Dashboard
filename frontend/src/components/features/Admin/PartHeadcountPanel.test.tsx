import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PartHeadcountPanel from './PartHeadcountPanel';

// 서버·쿼리 없이 패널만 — 훅은 가짜로(저장 함수 호출 내용을 검사)
const save = vi.fn().mockResolvedValue({});
const settings = { parts: { PM: 6.6, SW: 9 }, parts27: {} as Record<string, number>, updated_at: '', updated_by: '' };

vi.mock('@/hooks/useHeadcount', () => ({
  useHeadcount: () => ({ settings, isLoading: false, save, isSaving: false, error: null }),
}));
// 렌더마다 새 객체를 돌려주면 패널의 서버값→입력칸 동기화(useEffect)가 무한 렌더에 빠짐 — 실제 react-query처럼 같은 참조를 돌려줌
const options = { parts: ['① PM', '② SW'] };
const optionsResult = { data: options };
vi.mock('@/hooks/usePerformanceData', () => ({
  usePerformanceOptions: () => optionsResult,
}));

describe('PartHeadcountPanel 2026 / 2027 인원 따로(2026-10-29)', () => {
  beforeEach(() => { save.mockClear(); });

  it('처음엔 2026년 인원 — 저장된 값이 보이고, 2027 칩을 누르면 비어 있는 2027 입력칸이 나온다', () => {
    render(<PartHeadcountPanel hideTitle />);
    expect((screen.getByLabelText('PM 2026년 인원') as HTMLInputElement).value).toBe('6.6');
    fireEvent.click(screen.getByText('2027년 인원'));
    expect((screen.getByLabelText('PM 2027년 인원') as HTMLInputElement).value).toBe('');   // 2026 값을 빌려 보여주지 않음
    expect(screen.getByText(/2027 계획 보기 — 인당/)).toBeTruthy();
  });

  it('저장하면 2026·2027 인원을 같이 보낸다(한쪽만 고쳐도 다른 쪽을 지우지 않게)', () => {
    render(<PartHeadcountPanel hideTitle />);
    fireEvent.click(screen.getByText('2027년 인원'));
    fireEvent.change(screen.getByLabelText('PM 2027년 인원'), { target: { value: '7' } });
    fireEvent.click(screen.getByText('저장'));
    expect(save).toHaveBeenCalledWith({
      parts:   { PM: '6.6', SW: '9' },     // 2026은 그대로
      parts27: { PM: '7', SW: '' },
    });
  });

  it('저장 안 한 변경이 있는 연도 칩에는 ●가 붙는다', () => {
    render(<PartHeadcountPanel hideTitle />);
    expect(screen.queryByText('2027년 인원 ●')).toBeNull();
    fireEvent.click(screen.getByText('2027년 인원'));
    fireEvent.change(screen.getByLabelText('SW 2027년 인원'), { target: { value: '3' } });
    expect(screen.getByText('2027년 인원 ●')).toBeTruthy();
    expect(screen.queryByText('2026년 인원 ●')).toBeNull();
  });

  it('"2026 인원 불러오기"는 2026 값을 2027 입력칸에 복사만 한다(저장은 따로)', () => {
    render(<PartHeadcountPanel hideTitle />);
    fireEvent.click(screen.getByText('2027년 인원'));
    fireEvent.click(screen.getByText('2026 인원 불러오기'));
    expect((screen.getByLabelText('PM 2027년 인원') as HTMLInputElement).value).toBe('6.6');
    expect((screen.getByLabelText('SW 2027년 인원') as HTMLInputElement).value).toBe('9');
    expect(save).not.toHaveBeenCalled();
  });
});
