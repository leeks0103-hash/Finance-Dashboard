import { useCallback } from 'react';
import { useUiStore } from '@/store';
import { useVisible } from '@/hooks/useVisibility';
import { openToolDownloadHref } from '@/api/openTool.api';

/**
 * 파일 열기 도구(2026-11-06) — 설치 표시·안내 창·설치 파일 받기를 한 곳에서.
 * 설치 표시(installed)는 이 브라우저에만 저장(ui.store) — 서버는 접속자 PC에 뭐가 깔렸는지 알 수 없음.
 * 파일·폴더 바로가기 버튼은 이 표시가 켜져 있어야 보임(App의 FileOpenVisibleContext)
 */
export const useOpenToolViewModel = () => {
  const installed = useUiStore(s => s.openToolInstalled);
  const setInstalled = useUiStore(s => s.setOpenToolInstalled);
  const modalOpen = useUiStore(s => s.openToolModalOpen);
  const setModalOpen = useUiStore(s => s.setOpenToolModalOpen);

  // 설치 메뉴를 보여줄지 — 파일·폴더 바로가기 공개 범위(서버 설정)가 이 사용자에게 열려 있을 때만.
  // ⚠️ 훅을 `||`로 묶어 부르지 말 것: 앞이 참이면 뒤 훅이 건너뛰어져 공개 범위 응답이 오기 전후로 훅 호출 순서가 바뀌고
  // 화면 전체가 오류 화면이 됨(2026-11-06 실제 장애). 항상 둘 다 부른 뒤 합침
  const fileOffered = useVisible('fileOpen');
  const folderOffered = useVisible('folderOpen');

  // 지금 접속 중인 주소를 zip에 넣어 두면 설치가 끝난 뒤 그 주소가 열리며 설치 표시가 켜짐
  const download = useCallback(() => {
    const a = document.createElement('a');
    a.href = openToolDownloadHref(window.location.origin);
    a.download = 'HmcOpen.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return {
    offered: fileOffered || folderOffered,
    installed,
    markInstalled:   useCallback(() => setInstalled(true), [setInstalled]),
    clearInstalled:  useCallback(() => setInstalled(false), [setInstalled]),
    modalOpen,
    openModal:       useCallback(() => setModalOpen(true), [setModalOpen]),
    closeModal:      useCallback(() => setModalOpen(false), [setModalOpen]),
    download,
  };
};
