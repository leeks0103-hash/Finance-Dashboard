import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChartStateGrid from './ChartStateGrid';

const items = [{ key: 'a', className: 'span4' }, { key: 'b' }];

describe('ChartStateGrid', () => {
  it('skeleton은 칸마다 하나씩, 칸 크기 클래스를 그대로 쓴다', () => {
    const { container } = render(<ChartStateGrid variant="skeleton" items={items} />);
    expect(container.children).toHaveLength(2);
    expect(container.children[0].className).toContain('span4');
  });

  it('error·empty는 칸마다 같은 문구 카드', () => {
    render(<ChartStateGrid variant="error" items={items} icon="⚠" message="불러올 수 없음" />);
    expect(screen.getAllByText('불러올 수 없음')).toHaveLength(2);
  });

  it('minHeight는 --state-card-min-h로 넘긴다', () => {
    const { container } = render(<ChartStateGrid variant="empty" items={items} message="없음" minHeight={430} />);
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--state-card-min-h')).toBe('430px');
  });
});
