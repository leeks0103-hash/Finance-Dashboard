import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HiddenPartsBar from './HiddenPartsBar';
import CostChartSwitch from './CostChartSwitch';

describe('HiddenPartsBar (원가분석 — 숨긴 파트 되돌리기)', () => {
  it('숨긴 파트가 없으면 아무것도 안 그림', () => {
    const { container } = render(<HiddenPartsBar parts={[]} onRestore={() => {}} onRestoreAll={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('숨긴 파트를 칩으로 보여 주고, 누르면 그 파트만 다시 보이기(원문자 뗀 이름으로 표시, 원본 이름으로 호출)', () => {
    const onRestore = vi.fn();
    render(<HiddenPartsBar parts={['② 신사업']} onRestore={onRestore} onRestoreAll={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '신사업 다시 보기' }));
    expect(onRestore).toHaveBeenCalledWith('② 신사업');
    // 하나뿐이면 "모두 보기"는 중복이라 안 그림
    expect(screen.queryByRole('button', { name: '모두 보기' })).not.toBeInTheDocument();
  });

  it('둘 이상이면 "모두 보기"로 한 번에 복원', () => {
    const onRestoreAll = vi.fn();
    render(<HiddenPartsBar parts={['① PM', '⑤ SW']} onRestore={() => {}} onRestoreAll={onRestoreAll} />);
    expect(screen.getByRole('button', { name: 'PM 다시 보기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SW 다시 보기' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '모두 보기' }));
    expect(onRestoreAll).toHaveBeenCalledTimes(1);
  });

  it('CostChartSwitch의 top 자리에 차트 위로 들어감', () => {
    render(
      <CostChartSwitch
        bars={<div>막대 차트</div>}
        dumbbell={<div>덤벨 차트</div>}
        top={<HiddenPartsBar parts={['① PM']} onRestore={() => {}} onRestoreAll={() => {}} />}
      />,
    );
    const chip = screen.getByRole('button', { name: 'PM 다시 보기' });
    const chart = screen.getByText('막대 차트');
    // 칩이 차트보다 문서 앞쪽(위)에 있음
    expect(chip.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
