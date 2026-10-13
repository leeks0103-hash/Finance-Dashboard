import axios from 'axios';

/** 관리자 로그인 토큰 저장 위치(localStorage) — 키 이름은 공용 키 시절 그대로(2026-10-06 사번 로그인으로 교체) */
export const ADMIN_TOKEN_STORAGE = 'extract-admin-key';

const client = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// 모든 요청에 로그인 토큰을 실음 — 로그인 안 하면 서버가 데이터 API를 전부 401로 막음(2026-10-13)
client.interceptors.request.use(config => {
  try {
    const token = localStorage.getItem(ADMIN_TOKEN_STORAGE);
    if (token && !config.headers.has('X-Extract-Key')) config.headers.set('X-Extract-Key', token);
  } catch { /* 저장소 접근 불가(사생활 보호 모드 등) — 토큰 없이 보냄 */ }
  return config;
});

// 토큰이 무효가 되면(비밀번호 변경·계정 삭제) 서버가 401 — 로그인 화면으로 돌려보낼 쪽(useAuthSession)이 등록
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null): void => { onUnauthorized = fn; };

client.interceptors.response.use(undefined, err => {
  const url: string = err?.config?.url ?? '';
  if (err?.response?.status === 401 && !url.startsWith('/auth/')) onUnauthorized?.();
  return Promise.reject(err);
});

export default client;
