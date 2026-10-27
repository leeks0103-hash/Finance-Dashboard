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
    expect(label?.classList.contains(styles.labelNoted)).toBe(true);   // 매출이익 카드 제목 전용 클래스
  });

  it('labelNote가 없으면 안내 줄을 그리지 않는다', () => {
    const { container } = render(<PerfCompareCard card={base} />);
    expect(container.querySelector(`.${styles.labelNote}`)).toBeNull();
    expect(container.querySelector(`.${styles.label}`)?.classList.contains(styles.labelNoted)).toBe(false);
  });
});

describe('PerfCompareCard 계획 값이 없을 때(관리비·경상손익, 팀·파트 필터 중 등)', () => {
  it('계획 칸은 "-"로 두고 차이 알약(▲/▼)은 그리지 않는다', () => {
    const { container } = render(<PerfCompareCard card={{ ...base, planStr: '-', planNum: 0, diffStr: '', diffUp: true }} />);
    expect(container.querySelector(`.${styles.plan}`)?.textContent).toBe('-');
    expect(container.querySelector(`.${styles.diff}`)).toBeNull();
  });

  it('계획 값이 있으면 차이 알약을 그린다', () => {
    const { container } = render(<PerfCompareCard card={base} />);
    expect(container.querySelector(`.${styles.diff}`)?.textContent).toContain('+6.9억원');
  });
});

describe('PerfCompareCard 스파크라인(2026-10-27 삭제 요청으로 안 그림)', () => {
  it('차이 배지가 있어도 스파크라인(.sparkWrap)을 그리지 않는다', () => {
    const { container } = render(<PerfCompareCard card={base} />);
    expect(container.querySelector(`.${styles.sparkWrap}`)).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('PerfCompareCard 제목·보조 줄 배치', () => {
  it('"(계획/추정)"은 제목 앞부분과 다른 줄(.labelSuffix)로 그린다', () => {
    const { container } = render(<PerfCompareCard card={base} />);
    expect(container.querySelector(`.${styles.labelMain}`)?.textContent?.trim()).toBe('당해 연도 매출이익');
    expect(container.querySelector(`.${styles.labelSuffix}`)?.textContent).toBe('(계획/추정)');
  });

  it('sub는 값 바로 아래(.sub)에 그린다 — 제목 아래(.labelNote)가 아님', () => {
    const { container } = render(<PerfCompareCard card={{ ...base, sub: '매출 - (직접원가 + 공통원가)' }} />);
    expect(container.querySelector(`.${styles.sub}`)?.textContent).toBe('매출 - (직접원가 + 공통원가)');
    expect(container.querySelector(`.${styles.labelNote}`)).toBeNull();
  });
});

describe('PerfCompareCard 계획 대비 추정(%)', () => {
  it('rateStr이 있으면 추정 값 위 줄(.rate)에 "계획 대비 N%"로 그린다', () => {
    const { container } = render(<PerfCompareCard card={{ ...base, rateStr: '112.0%' }} />);
    expect(container.querySelector(`.${styles.rate}`)?.textContent).toBe('계획 대비 112.0%');
  });

  it('rateStr이 없으면 글자는 없고 줄(.rateRow)만 남겨 카드마다 값 높이를 맞춘다', () => {
    const { container } = render(<PerfCompareCard card={base} />);
    expect(container.querySelector(`.${styles.rate}`)).toBeNull();
    expect(container.querySelector(`.${styles.rateRow}`)).not.toBeNull();
  });
});
