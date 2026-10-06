/**
 * 원본 파일 열기 함수 — openFolder가 붙어 있으면 CopyText·셀 팝업이 ↗ 옆에 폴더 버튼도 그림(2026-10-06).
 * 호출부는 열기 함수만 넘기면 되고(hooks/useOpenFile이 짝을 붙여 줌), ui는 이 모양만 앎
 */
export type FileOpener = ((filename: string) => void | Promise<unknown>) & {
  openFolder?: (filename: string) => void | Promise<unknown>;
};
