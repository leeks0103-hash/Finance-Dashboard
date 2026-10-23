import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import PerfCompareCard from './PerfCompareCard';
import type { PerfCompareCardData } from '@/hooks/viewmodels/usePerformanceViewModel';
import styles from './PerfCompareCard.module.css';

const base: PerfCompareCardData = {
  kind: 'compare', id: 'grossProfit', label: '당해 연도 매출이익 (계획/추정)', accent: 'profit',
  planStr: '107.5억원', estStr: '114.4억원', planNum: 107.5, estNum: 114.4, diffStr: '+6.9억원', diffUp: true,
};

describe('PerfCompareCard 제목 아래 안내(labelNote)', () => {
  it('labelNote가 있으면 제목 줄 아래 별도 클래스(.labelNote) 한 줄로 그린다', () => {
    const { container } = render(<PerfCompareCard card={{ ...base, labelNote: '매출 - (직접원가 + 공통원가)' }} />);
    const label = container.querySelector(`.${styles.label}`);
    const note = label?.querySelector(`.${styles.labelNote}`);
    expect(note?.textContent).toBe('매출 - (직접원가 + 공통원가)');
    expect(label?.textContent).toBe('당해 연도 매출이익 (계획/추정)매출 - (직접원가 + 공통원가)');
  });

  it('labelNote가 없으면 안내 줄을 그리지 않는다', () => {
    const { container } = render(<PerfCompareCard card={base} />);
    expect(container.querySelector(`.${styles.labelNote}`)).toBeNull();
  });
});
