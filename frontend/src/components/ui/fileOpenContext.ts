import { createContext } from 'react';

/**
 * 파일 바로가기(↗)·폴더 바로가기 버튼을 보여줄지 — CopyText·CellPopup이 읽는다. 둘은 따로 관리(2026-10-20).
 * ui는 store·인증을 몰라야 해서 값 계산은 App(useVisible('fileOpen'/'folderOpen'))이 하고 여기로 내려준다.
 * Provider 밖(테스트 등)에선 기본 둘 다 true = 예전처럼 onOpen만 있으면 보임.
 */
export interface FileOpenVisible { file: boolean; folder: boolean }
export const FileOpenVisibleContext = createContext<FileOpenVisible>({ file: true, folder: true });
