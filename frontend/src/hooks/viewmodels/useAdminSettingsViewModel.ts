import { confirmDialog } from '@/utils/dialog';
import { useVisibilitySettings } from '@/hooks/useVisibility';
import { useLoginRequired, useSetLoginRequired } from '@/hooks/useLoginRequired';
import type { Visibility, VisibilitySettings } from '@/types/settings.types';

export type VisibilityOption = { value: Visibility; label: string; title: string };

/** 공개 범위 설정 — 서버(data/visibility.json)에 저장돼 모든 사람 화면에 같이 적용(2026-10-06) */
export const VISIBILITY_ITEMS: { key: keyof VisibilitySettings; label: string; options: VisibilityOption[] }[] = [
  {
    // 파트별 계획 vs 실적 드릴다운의 달성률(행별·합계·CSV). 처음엔 저조한 팀이 드러나지 않게 '전체'를 뺐다가
    // 관리자가 고를 수 있게 추가(2026-10-14 요청). 기본값은 숨김
    key: 'achieveRate', label: '달성률',
    options: [
      { value: 'all',   label: '전체',   title: '모든 사람에게 달성률 표시' },
      { value: 'admin', label: '관리자', title: '관리자 인증한 브라우저에만 표시' },
      { value: 'none',  label: '숨김',   title: '아무에게도 표시 안 함' },
    ],
  },
  {
    key: 'fileOpen', label: '파일 바로가기(↗)',
    options: [
      { value: 'all',   label: '전체',   title: '모든 사람에게 ↗ 버튼 표시' },
      { value: 'admin', label: '관리자', title: '관리자 인증한 브라우저에만 표시' },
      { value: 'none',  label: '숨김',   title: '아무에게도 표시 안 함' },
    ],
  },
  {
    // 파일 바로가기와 따로(2026-10-20 요청 — ↗를 숨기면 폴더 버튼까지 같이 숨던 것)
    key: 'folderOpen', label: '폴더 바로가기',
    options: [
      { value: 'all',   label: '전체',   title: '모든 사람에게 폴더 열기 버튼 표시' },
      { value: 'admin', label: '관리자', title: '관리자 인증한 브라우저에만 표시' },
      { value: 'none',  label: '숨김',   title: '아무에게도 표시 안 함' },
    ],
  },
  {
    // 업데이트(재추출) 요청 버튼 — 파일명 옆 아이콘·셀 팝업. 기본 숨김(2026-10-22), 관리자가 켜면 해당 범위에 보임.
    // 요청이 쌓이면 관리자에게만 헤더 노란 "!"가 뜸(공개 범위와 무관)
    key: 'extractRequest', label: '업데이트 요청',
    options: [
      { value: 'all',   label: '전체',   title: '모든 사람에게 업데이트 요청 버튼 표시' },
      { value: 'admin', label: '관리자', title: '관리자 인증한 브라우저에만 표시' },
      { value: 'none',  label: '숨김',   title: '아무에게도 표시 안 함' },
    ],
  },
];

/**
 * 관리자 페이지 > 화면 설정(공개 범위·로그인 요구·AI 인사이트) — 예전 AdminModal 위쪽 절반(2026-10-23 페이지로 분리).
 * 로그인 요구를 끌 때만 확인창(끄면 누구나 로그인 없이 모든 데이터 조회)
 */
export const useAdminSettingsViewModel = () => {
  const visibility = useVisibilitySettings();
  const access = useLoginRequired();
  const setLoginRequired = useSetLoginRequired();

  const toggleLoginRequired = async () => {
    if (access.loginRequired && !await confirmDialog(
      '로그인 요구를 끄면 접속한 누구나 로그인 없이 모든 데이터를 볼 수 있습니다.\n계속할까요?',
      { title: '로그인 요구 끄기', confirmText: '끄기', danger: true },
    )) return;
    setLoginRequired.set(!access.loginRequired);
  };

  return {
    visibilityValues: visibility.settings,
    setVisibility:    (key: keyof VisibilitySettings, value: Visibility) => visibility.update({ [key]: value }),
    visibilityError:  visibility.isError,
    loginRequired:    access.loginRequired,
    toggleLoginRequired,
    loginRequiredError: setLoginRequired.isError,
    aiInsightOn:      visibility.settings.aiInsight !== 'none',
    toggleAiInsight:  () => visibility.update({ aiInsight: visibility.settings.aiInsight === 'none' ? 'all' : 'none' }),
  };
};
