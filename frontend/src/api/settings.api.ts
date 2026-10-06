import client from './client';
import { authHeaders } from './extract.api';
import type { VisibilitySettings } from '@/types/settings.types';

export const getVisibility = (): Promise<VisibilitySettings> =>
  client.get<VisibilitySettings>('/settings/visibility').then(r => r.data);

/** 관리자 키 필요 — 바꾼 항목만 보내면 나머지는 서버 값 유지. 응답은 저장된 전체 설정 */
export const putVisibility = (patch: Partial<VisibilitySettings>): Promise<VisibilitySettings> =>
  client.put<VisibilitySettings>('/settings/visibility', patch, { headers: authHeaders() }).then(r => r.data);
