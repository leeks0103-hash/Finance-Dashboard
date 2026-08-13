/** M-13: toggle 유틸 — filter.store와 FilterPanel에서 공유 */
export const toggle = (arr: string[], val: string): string[] =>
  arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

/** "전체" 칩 체크 상태 판별 — 옵션이 1개 이상이고 전부 선택되어 있는지 */
export const isAllSelected = (selected: string[], all: string[]): boolean =>
  all.length > 0 && all.every(v => selected.includes(v));
