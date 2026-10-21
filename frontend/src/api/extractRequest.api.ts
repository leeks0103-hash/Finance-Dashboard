import client from './client';

/** PPT 업데이트(재추출) 요청 — 2026-10-21. 서버 extract_requests.py */
export interface ExtractRequestState {
  /** 원본 파일 수정 시각(YYYY-MM-DD HH:MM:SS) — 원본 위치를 못 찾으면 null */
  modified: string | null;
  /** 재무·KPI 처리이력 중 마지막 처리일시 — 한 번도 추출 안 됐으면 null */
  last_extracted: string | null;
  /** 원본이 마지막 추출 뒤에 바뀌었는지 — 알 수 없으면 null */
  changed: boolean | null;
}

export interface ExtractRequestEntry { at: string; by: string }

export interface ExtractRequestItem extends ExtractRequestState, ExtractRequestEntry { file: string }

/** 요청 전 확인 — 바뀜 여부 + 이미 요청돼 있으면 그 요청 */
export const checkExtractRequest = (file: string): Promise<ExtractRequestState & { requested?: ExtractRequestEntry | null }> =>
  client.post('/extract-requests/check', { file }).then(r => r.data);

export const sendExtractRequest = (file: string): Promise<{ ok: boolean; request: ExtractRequestEntry }> =>
  client.post('/extract-requests', { file }).then(r => r.data);

/** 관리자 — 남은 요청 목록(요청 늦은 순) */
export const getExtractRequests = (): Promise<{ ok: boolean; items: ExtractRequestItem[] }> =>
  client.get('/extract-requests').then(r => r.data);

/** 관리자 — 추출 없이 요청 지움 */
export const dismissExtractRequest = (file: string): Promise<{ ok: boolean }> =>
  client.post('/extract-requests/dismiss', { file }).then(r => r.data);
