import { getStoredExtractKey } from './extract.api';

/**
 * 파일 열기 도구 설치 파일(zip) 받기 주소 — <a href>는 헤더를 못 실어서 로그인 토큰을 주소에 붙임(downloadHref와 같은 방식).
 * origin은 지금 접속 중인 대시보드 주소 — 서버가 zip에 넣어 두면 설치가 끝난 뒤 그 주소를 열어 "이 브라우저는 설치됨"을 표시함
 */
export const openToolDownloadHref = (origin: string): string =>
  `/api/open-tool/download?origin=${encodeURIComponent(origin)}&token=${encodeURIComponent(getStoredExtractKey())}`;
