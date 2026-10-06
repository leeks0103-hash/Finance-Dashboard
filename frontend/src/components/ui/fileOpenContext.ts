import { createContext } from 'react';

/**
 * 파일 바로가기(↗) 버튼을 보여줄지 — CopyText·CellPopup이 읽는다.
 * ui는 store·인증을 몰라야 해서 값 계산은 App(useVisible('fileOpen'))이 하고 여기로 내려준다.
 * Provider 밖(테스트 등)에선 기본 true = 예전처럼 onOpen만 있으면 보임.
 */
export const FileOpenVisibleContext = createContext(true);
