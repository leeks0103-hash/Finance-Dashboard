import client from './client';
import type { ExtractTarget, ExtractMode, ExtractStatus } from '@/types/extract.types';

// 서버 EXTRACT_ADMIN_KEY와 대조해서 통과한 값만 저장 — 이 브라우저(=이 PC)에서만 유효,
// 한 번 입력하면 다음부턴 다시 안 물어봄. 이름은 보안용이 아니라 "누가 실행 중인지" 표시용
const KEY_STORAGE  = 'extract-admin-key';
const NAME_STORAGE = 'extract-admin-name';

export const getStoredExtractKey  = (): string => localStorage.getItem(KEY_STORAGE) ?? '';
export const getStoredExtractName = (): string => localStorage.getItem(NAME_STORAGE) ?? '';
export const setStoredExtractAuth = (key: string, name: string): void => {
  localStorage.setItem(KEY_STORAGE, key);
  localStorage.setItem(NAME_STORAGE, name);
};
export const clearStoredExtractAuth = (): void => {
  localStorage.removeItem(KEY_STORAGE);
  localStorage.removeItem(NAME_STORAGE);
};

export const authExtract = (key: string): Promise<boolean> =>
  client.post<{ ok: boolean }>('/extract/auth', { key })
    .then(r => r.data.ok)
    .catch(() => false);

const authHeaders = () => {
  const key = getStoredExtractKey();
  return key ? { 'X-Extract-Key': key } : {};
};

interface RunExtractResult {
  ok:      boolean;
  started?: boolean;
  error?:  string;
}

export const runExtract = (targets: ExtractTarget[], mode: ExtractMode): Promise<RunExtractResult> =>
  client.post<RunExtractResult>(
    '/extract/run',
    { targets, mode, started_by: getStoredExtractName() },
    { headers: authHeaders() },
  )
    .then(r => r.data)
    .catch((err): RunExtractResult => err?.response?.data ?? { ok: false, error: '요청에 실패했습니다.' });

export const getExtractStatus = (): Promise<ExtractStatus> =>
  client.get<ExtractStatus>('/extract/status').then(r => r.data);

interface CancelExtractResult {
  ok:     boolean;
  error?: string;
}

export const cancelExtract = (): Promise<CancelExtractResult> =>
  client.post<CancelExtractResult>('/extract/cancel', undefined, { headers: authHeaders() })
    .then(r => r.data)
    .catch((err): CancelExtractResult => err?.response?.data ?? { ok: false, error: '중지 요청에 실패했습니다.' });
