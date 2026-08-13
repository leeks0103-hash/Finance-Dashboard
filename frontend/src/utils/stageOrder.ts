/** 보고단계 정렬 순서 — 필터 칩/드롭다운, 차트 라벨 등 보고단계가 노출되는 모든 곳에서 공용 사용 */
export const STAGE_ORDER = ['검토', '사업계획', '사전검토', '제안', '착수', '중간', '완료'];

export const sortStages = (stages: string[]): string[] => {
  const known   = STAGE_ORDER.filter(s => stages.includes(s));
  const unknown = stages.filter(s => !STAGE_ORDER.includes(s)).sort();
  return [...known, ...unknown];
};
