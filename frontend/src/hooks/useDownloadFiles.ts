import { useQuery } from '@tanstack/react-query';
import client from '@/api/client';
import { getStoredExtractKey } from '@/api/extract.api';
import { STALE_5MIN, GC_10MIN } from './queryClient';

export interface DownloadFile {
  key:       string;
  label:     string;
  desc:      string;
  filename:  string;
  available: boolean;
  size:      number;
  /** 파일 최종 수정 시각 "YYYY-MM-DD HH:MM" — 추출 재실행 시 갱신됨 */
  modified:  string;
}

/**
 * 다운로드 가능한 엑셀 목록 + 최종 수정 시각.
 * 실제 파일은 /api/download/<key> 를 열면 서버가 그 시점의 디스크 파일을 그대로 내보낸다
 * (사본을 캐시하지 않으므로 추출 스크립트가 덮어쓰면 다음 다운로드부터 최신본).
 */
/** 파일 받기 주소 — <a href>는 헤더를 못 실어서 로그인 토큰을 주소에 붙임(서버가 로그인 확인, 2026-10-13) */
export const downloadHref = (key: string): string =>
  `/api/download/${key}?token=${encodeURIComponent(getStoredExtractKey())}`;

export const useDownloadFiles = () =>
  useQuery({
    queryKey:  ['download-files'],
    queryFn:   () => client.get<{ files: DownloadFile[] }>('/download').then(r => r.data.files),
    staleTime: STALE_5MIN,
    gcTime:    GC_10MIN,
    retry:     1,
    meta: { queryType: 'download-files' },
  });
