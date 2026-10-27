import client from './client';
import { authHeaders } from './extract.api';
import type { VisibilitySettings, PerfUpdateNote, HeadcountSettings } from '@/types/settings.types';

export const getVisibility = (): Promise<VisibilitySettings> =>
  client.get<VisibilitySettings>('/settings/visibility').then(r => r.data);

/** 관리자 키 필요 — 바꾼 항목만 보내면 나머지는 서버 값 유지. 응답은 저장된 전체 설정 */
export const putVisibility = (patch: Partial<VisibilitySettings>): Promise<VisibilitySettings> =>
  client.put<VisibilitySettings>('/settings/visibility', patch, { headers: authHeaders() }).then(r => r.data);

export const getPerfUpdateNote = (): Promise<PerfUpdateNote> =>
  client.get<PerfUpdateNote>('/settings/perf-update').then(r => r.data);

/** 관리자만 — 바꾼 항목만 보내면 됨. 응답은 저장된 전체 값 */
export const putPerfUpdateNote = (patch: Partial<PerfUpdateNote>): Promise<PerfUpdateNote> =>
  client.put<PerfUpdateNote>('/settings/perf-update', patch, { headers: authHeaders() }).then(r => r.data);

/** 로그인을 요구하는지 — 로그인 전에도 부를 수 있음(화면이 로그인 화면을 그릴지 정하려고). 서버 data/access.json */
export const getLoginRequired = (): Promise<boolean> =>
  client.get<{ loginRequired: boolean }>('/settings/access').then(r => r.data.loginRequired);

/** 관리자만 — 로그인 요구 켜기/끄기. 응답은 저장된 값 */
export const putLoginRequired = (loginRequired: boolean): Promise<boolean> =>
  client.put<{ loginRequired: boolean }>('/settings/access', { loginRequired }, { headers: authHeaders() }).then(r => r.data.loginRequired);

/** 파트별 인원 — 로그인한 누구나 읽음(인당 차트 분모는 요약 API가 이미 계산해 내려주고, 이 값은 관리자 입력창이 씀) */
export const getHeadcount = (): Promise<HeadcountSettings> =>
  client.get<HeadcountSettings>('/settings/headcount').then(r => r.data);

/** 관리자만 — 현재 파트 인원 전체를 통째로 교체. 빈 값·0은 '미입력'. 응답은 저장된 값
 *  plan_parts(계획 인원)는 2026-10-27 주석 처리 — 안 보내면 서버가 저장돼 있던 계획 인원을 그대로 유지 */
// export const putHeadcount = (body: { parts: Record<string, number | string>; plan_parts: Record<string, number | string> }): Promise<HeadcountSettings> =>
export const putHeadcount = (body: { parts: Record<string, number | string> }): Promise<HeadcountSettings> =>
  client.put<HeadcountSettings>('/settings/headcount', body, { headers: authHeaders() }).then(r => r.data);
