/** 작은 깔때기 아이콘 — 필터 자리 표시용(상단 필터바·원가 비율 카드 셀렉트 왼쪽, 2026-10-21). 색은 부모 글자색 */
const FilterIcon = ({ size = 13, className }: { size?: number; className?: string }) => (
  <svg className={className} viewBox="0 0 12 12" width={size} height={size} aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M1.5 2h9L7.2 6.2v3.5L4.8 10.8V6.2L1.5 2Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  </svg>
);

export default FilterIcon;
