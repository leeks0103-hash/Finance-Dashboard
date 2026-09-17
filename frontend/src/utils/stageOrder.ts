/**
 * 보고단계 정렬 순서 — 필터 칩/드롭다운, 차트 라벨 등 보고단계가 노출되는 모든 곳에서 공용 사용.
 * "추가제안"은 로우데이터(재무이력·KPI 취합 등)에만 노출되는 임시 단계라 필터 칩 옵션
 * 목록(백엔드 options 엔드포인트, useFilterOptions)에서 이미 제외돼 있음 — 여기 순서는
 * 그런 옵션 목록이 아니라 "재무이력" 같은 raw 테이블이 이 값을 받았을 때를 위한 것.
 */
export const STAGE_ORDER = ['검토', '사업계획', '사전검토', '제안', '추가제안', '착수', '중간', '완료'];

export const sortStages = (stages: string[]): string[] => {
  const known   = STAGE_ORDER.filter(s => stages.includes(s));
  const unknown = stages.filter(s => !STAGE_ORDER.includes(s)).sort();
  return [...known, ...unknown];
};
