/** M-13: toggle 유틸 — filter.store와 FilterPanel에서 공유 */
export const toggle = (arr: string[], val: string): string[] =>
  arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
