import client, { ADMIN_TOKEN_STORAGE } from './client';
import type { ExtractTarget, ExtractMode, ExtractStatus, ExtractCoverage } from '@/types/extract.types';

// 사번·비밀번호로 로그인하면 서버가 준 토큰만 저장 — 이 브라우저(=이 PC)에서만 유효, 한 번 로그인하면
// 다음부턴 다시 안 물어봄(로그아웃 전까지). 이름은 서버가 .env 계정 목록에서 알려준 값(화면 표시용)
const NAME_STORAGE = 'extract-admin-name';

export const getStoredExtractKey  = (): string => localStorage.getItem(ADMIN_TOKEN_STORAGE) ?? '';
export const getStoredExtractName = (): string => localStorage.getItem(NAME_STORAGE) ?? '';
export const setStoredExtractAuth = (token: string, name: string): void => {
  localStorage.setItem(ADMIN_TOKEN_STORAGE, token);
  localStorage.setItem(NAME_STORAGE, name);
};
export const clearStoredExtractAuth = (): void => {
  localStorage.removeItem(ADMIN_TOKEN_STORAGE);
  localStorage.removeItem(NAME_STORAGE);
};

interface LoginResult { ok: boolean; token?: string; name?: string; emp_no?: string }

export const loginAdmin = (empNo: string, password: string): Promise<LoginResult> =>
  client.post<LoginResult>('/auth/login', { emp_no: empNo, password })
    .then(r => r.data)
    .catch((): LoginResult => ({ ok: false }));

/** 저장된 토큰이 아직 유효한지 — 계정 삭제·비밀번호 변경·예전 공용 키면 false. 서버에 못 닿으면 null(판단 보류) */
export const verifyAdmin = (): Promise<boolean | null> =>
  client.get<{ ok: boolean }>('/auth/me').then(r => r.data.ok).catch(() => null);

export const authHeaders = () => {
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
    { targets, mode },
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

/** 추출 현황 — 원본 폴더 파일 수 vs 실제로 추출된 파일, 안 된 파일과 이유. refresh면 서버 캐시(30초) 무시 */
/** 추출 현황 목록의 원본 PPT 열기 — 폴더에서 찾은 경로 기준(미처리·실패 파일도 열림). check=true면 열 수 있는지만 */
export const openCoverageFile = (filename: string, check = false, folder = false): Promise<{ ok: boolean; message?: string; locked?: boolean; blocked?: boolean; checked?: boolean }> =>
  client.post('/extract/open-file', { filename, check, folder }, { headers: authHeaders() })
    .then(r => r.data)
    .catch(err => err?.response?.data ?? { ok: false, message: '파일을 열 수 없습니다.' });

export const getExtractCoverage = (refresh = false): Promise<ExtractCoverage> =>
  client.get<ExtractCoverage>('/extract/coverage', { params: refresh ? { refresh: 1 } : undefined, headers: authHeaders() })
    .then(r => r.data)
    .catch((err): ExtractCoverage => err?.response?.data ?? { ok: false, error: '추출 현황을 불러오지 못했습니다.' });
