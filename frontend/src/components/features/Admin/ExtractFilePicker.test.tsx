import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

const files = ['가.pptx', '나.pptx', '다.pptx', '라.pptx', '마.pptx'];
vi.mock('@/hooks/useExtractCoverage', () => ({
  useExtractCoverage: () => ({
    isLoading: false,
    data: {
      finance: { items: files.map(f => ({ file: f, status: 'extracted' })) },
      kpi: { items: [] },
    },
  }),
}));
vi.mock('@/hooks/useDataHealth', () => ({ useDataHealth: () => ({ data: undefined }) }));
import ExtractFilePicker from './ExtractFilePicker';

const order = (c: HTMLElement) =>
  [...c.querySelectorAll('input[type="checkbox"]')].map(i => (i.closest('label, li, tr, div') as HTMLElement)?.textContent ?? '');

describe('ExtractFilePicker 처음 골라져 온 파일을 맨 위로', () => {
  it('처음부터 선택된 파일(라·마)이 목록 맨 위에 온다', () => {
    const { container } = render(
      <ExtractFilePicker selected={['마.pptx', '라.pptx']} onChange={() => {}} targets={['finance']} />,
    );
    const names = order(container);
    expect(names[0]).toContain('라.pptx');
    expect(names[1]).toContain('마.pptx');
    expect(names[2]).toContain('가.pptx');
  });

  it('선택이 없으면 가나다 순 그대로', () => {
    const { container } = render(<ExtractFilePicker selected={[]} onChange={() => {}} targets={['finance']} />);
    expect(order(container)[0]).toContain('가.pptx');
  });

  it('열린 뒤에 선택이 바뀌어도 목록 순서는 안 바뀐다(클릭할 때 뛰지 않게)', () => {
    const { container, rerender } = render(
      <ExtractFilePicker selected={['라.pptx']} onChange={() => {}} targets={['finance']} />,
    );
    rerender(<ExtractFilePicker selected={['라.pptx', '다.pptx']} onChange={() => {}} targets={['finance']} />);
    const names = order(container);
    expect(names[0]).toContain('라.pptx');
    expect(names[1]).toContain('가.pptx');   // 다.pptx는 뒤에서 체크됐으니 자리 그대로
  });
});
