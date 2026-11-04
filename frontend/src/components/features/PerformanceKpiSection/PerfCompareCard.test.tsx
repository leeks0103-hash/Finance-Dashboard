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

describe('PerfCompareCard 스파크라인(2026-10-27 삭제 요청 — 코드·CSS도 제거함, 2026-10-29)', () => {
  it('차이 배지가 있어도 그래프(svg)를 그리지 않는다', () => {
    const { container } = render(<PerfCompareCard card={base} />);
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

  it('subNote는 sub(매출 대비 N%) 아래 별도 줄(.subNote)로 그리고, 값 묶음에 높이 확보용 hasNote를 붙인다(2026-11-04)', () => {
    const { container } = render(
      <PerfCompareCard card={{ ...base, sub: '매출 대비 32.5%', subRight: true, subNote: '매출 - (직접원가 + 공통원가)' }} />,
    );
    const subs = container.querySelector(`.${styles.subs}`);
    expect(subs?.children[0].textContent).toBe('매출 대비 32.5%');
    expect(subs?.children[0].classList.contains(styles.subRight)).toBe(true);
    expect(subs?.children[1].classList.contains(styles.subNote)).toBe(true);
    expect(subs?.children[1].textContent).toBe('매출 - (직접원가 + 공통원가)');
    expect(container.querySelector(`.${styles.valuesWrap}`)?.classList.contains(styles.hasNote)).toBe(true);
  });

  it('subNote 없이 sub만 있으면 hasSub(한 줄 높이), 둘 다 없으면 보조 영역을 안 그린다', () => {
    const only = render(<PerfCompareCard card={{ ...base, sub: '매출 대비 5.3%' }} />);
    expect(only.container.querySelector(`.${styles.valuesWrap}`)?.classList.contains(styles.hasSub)).toBe(true);
    expect(only.container.querySelector(`.${styles.subNote}`)).toBeNull();
    only.unmount();
    const none = render(<PerfCompareCard card={base} />);
    expect(none.container.querySelector(`.${styles.subs}`)).toBeNull();
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

describe('PerfCompareCard 2027 계획 보기(26 추정 / 27 계획, 2026-10-29)', () => {
  const plan: PerfCompareCardData = {
    ...base, id: 'revenue', label: '27년 매출 (26 추정/27 계획)', accent: 'brand',
    planStr: '392.2억원', estStr: '387.5억원', planNum: 392.2, estNum: 387.5, diffStr: '-4.7억원', diffUp: false,
    rateStr: '98.8%', rateLabel: '26 추정 대비',
  };

  it('제목 끝 "(26 추정/27 계획)"도 둘째 줄(.labelSuffix)로 따로 그린다', () => {
    const { container } = render(<PerfCompareCard card={plan} />);
    expect(container.querySelector(`.${styles.labelMain}`)?.textContent?.trim()).toBe('27년 매출');
    expect(container.querySelector(`.${styles.labelSuffix}`)?.textContent).toBe('(26 추정/27 계획)');
  });

  it('비율 앞 글자는 rateLabel("26 추정 대비") — "계획 대비"가 아님', () => {
    const { container } = render(<PerfCompareCard card={plan} />);
    expect(container.querySelector(`.${styles.rate}`)?.textContent).toBe('26 추정 대비 98.8%');
  });

  it('rateLabel이 없으면 예전 그대로 "계획 대비"', () => {
    const { container } = render(<PerfCompareCard card={{ ...base, rateStr: '112.0%' }} />);
    expect(container.querySelector(`.${styles.rate}`)?.textContent).toBe('계획 대비 112.0%');
  });
});

describe('PerfCompareCard 마우스오버 툴팁(정확한 원 단위 값)', () => {
  const withTitles: PerfCompareCardData = {
    ...base,
    planTitle: '계획 10,750,000,000원', estTitle: '추정 11,440,000,000원', diffTitle: '차이(추정 − 계획) +690,000,000원',
  };

  it('계획·추정 값과 차이 알약에 title로 붙는다', () => {
    const { container } = render(<PerfCompareCard card={withTitles} />);
    expect(container.querySelector(`.${styles.plan}`)?.getAttribute('title')).toBe('계획 10,750,000,000원');
    expect(container.querySelector(`.${styles.est}`)?.getAttribute('title')).toBe('추정 11,440,000,000원');
    expect(container.querySelector(`.${styles.diff}`)?.getAttribute('title')).toBe('차이(추정 − 계획) +690,000,000원');
  });

  it('값이 없는 칸(title 없음)엔 툴팁을 달지 않는다', () => {
    const { container } = render(<PerfCompareCard card={{ ...base, planStr: '-', planNum: 0, diffStr: '', diffUp: true, estTitle: '추정 1원' }} />);
    expect(container.querySelector(`.${styles.plan}`)?.hasAttribute('title')).toBe(false);
    expect(container.querySelector(`.${styles.est}`)?.getAttribute('title')).toBe('추정 1원');
  });
});
