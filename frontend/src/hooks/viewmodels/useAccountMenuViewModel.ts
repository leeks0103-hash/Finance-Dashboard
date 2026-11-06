import { useMemo } from 'react';
import { useUiStore } from '@/store';
import { getStoredExtractKey, getStoredExtractName } from '@/api/extract.api';
import { useOpenToolViewModel } from './useOpenToolViewModel';

/**
 * 상단 바 사람 아이콘 — 일반 사용자용 계정 드롭다운(2026-11-06 요청).
 * 관리자는 같은 아이콘이 관리자 기능 창을 열고, 일반 사용자는 이 드롭다운(사번 + 이 브라우저에 "파일 열기 도구 설치됨" 표시)을 연다.
 * 설치 여부를 서버가 알 수 없어(브라우저별 localStorage 표시) 설치 직후 자동 표시가 다른 브라우저·주소로 가면 사람이 직접 켜야 해서 생긴 입구.
 */
export const useAccountMenuViewModel = () => {
  const authRole = useUiStore(s => s.authRole);
  const openTool = useOpenToolViewModel();

  // 사번 = 로그인 토큰("사번.서명")의 앞부분, 이름은 로그인 응답의 이름(계정에 이름이 없으면 사번과 같음)
  const { empNo, name } = useMemo(() => {
    const emp = getStoredExtractKey().split('.')[0] ?? '';
    return { empNo: emp, name: getStoredExtractName() };
    // authRole이 바뀌면(로그인·로그아웃) 다시 읽음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authRole]);

  return {
    /** 일반 사용자 드롭다운을 보일지 — 로그인했고 관리자가 아닐 때(관리자는 관리자 기능 창) */
    visible: authRole === 'user',
    empNo,
    /** 이름이 사번과 다를 때만(같으면 사번만 보여 줌) */
    name: name && name !== empNo ? name : '',
    /** 설치 표시 버튼을 보일지 — 파일·폴더 바로가기 공개 범위가 이 사용자에게 열려 있을 때만 */
    toolOffered: openTool.offered,
    installed: openTool.installed,
    markInstalled: openTool.markInstalled,
    clearInstalled: openTool.clearInstalled,
  };
};
