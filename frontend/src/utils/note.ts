/**
 * 비고 문자열을 분석해 Badge variant를 반환.
 * includes 대신 startsWith — '손실 없음' 같은 부정 표현의 false positive 방지.
 */
export const getNoteVariant = (note: string): 'loss' | 'warn' | null => {
  if (!note) return null;
  if (note.startsWith('손실')) return 'loss';
  if (note.startsWith('저수익')) return 'warn';
  return null;
};
