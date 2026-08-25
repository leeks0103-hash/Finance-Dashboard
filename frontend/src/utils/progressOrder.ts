/** 진행단계 정렬 순서 — 실적현황 진행단계별 차트 등 노출되는 모든 곳에서 공용 사용
 *  백엔드(performance.py)가 jsonify(sort_keys=True) 탓에 알파벳순으로 응답하므로 프론트에서 재정렬 필수 */
export const PROGRESS_ORDER = ['제안', '협의', '착수', '중간', '완료', '인큐베이팅', '이월', '드롭', '미정'];

export const sortProgress = (values: string[]): string[] => {
  const known   = PROGRESS_ORDER.filter(p => values.includes(p));
  const unknown = values.filter(p => !PROGRESS_ORDER.includes(p)).sort();
  return [...known, ...unknown];
};
