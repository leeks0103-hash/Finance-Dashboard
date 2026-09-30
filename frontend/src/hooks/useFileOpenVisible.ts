import { useUiStore } from '@/store';

/** 파일 바로가기(↗) 버튼을 이 브라우저에 보여줄지 — 관리자용 기능의 공개 범위 설정 기준 */
export const useFileOpenVisible = (): boolean => {
  const mode = useUiStore(s => s.fileOpenVisibility);
  const adminAuthed = useUiStore(s => s.adminAuthed);
  return mode === 'all' || (mode === 'admin' && adminAuthed);
};
