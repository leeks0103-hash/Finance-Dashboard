import { useEffect } from 'react';
import { useUiStore } from '@/store';
import { toast } from '@/utils/dialog';

/**
 * 설치 프로그램(tools/HmcOpen/install.ps1)이 끝나면 대시보드를 `/?opentool=1`로 연다 — 그때 이 브라우저에 "파일 열기 도구 설치됨"을
 * 표시하고(ui.store, localStorage) 주소에서 표시를 지움. 브라우저는 PC에 설치된 것을 직접 볼 수 없어서 이 방식으로 알림(2026-11-06).
 * 주소만으로 켜지므로 속이면 버튼이 보일 뿐 — 실제로 열 수 있는지는 PC의 도구가 다시 검사하므로 보안 경계가 아님.
 * 로그인 화면 뒤에서도 동작해야 해서 App 최상단에서 한 번만 호출
 */
export const useOpenToolMarker = (): void => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('opentool') !== '1') return;
    useUiStore.getState().setOpenToolInstalled(true);
    params.delete('opentool');
    const rest = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
    toast('파일 열기 도구 설치를 확인했어요. 이제 파일·폴더 바로가기를 쓸 수 있습니다');
  }, []);
};
