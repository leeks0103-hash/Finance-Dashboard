import axios from 'axios';

/** 관리자 로그인 토큰 저장 위치(localStorage) — 키 이름은 공용 키 시절 그대로(2026-10-06 사번 로그인으로 교체) */
export const ADMIN_TOKEN_STORAGE = 'extract-admin-key';

const client = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// 로그인했으면 모든 요청에 토큰을 실음 — 관리자 전용 데이터(프로젝트 상세·KPI 취합·미수주·원가 비율)를 받으려면 필요
client.interceptors.request.use(config => {
  try {
    const token = localStorage.getItem(ADMIN_TOKEN_STORAGE);
    if (token && !config.headers.has('X-Extract-Key')) config.headers.set('X-Extract-Key', token);
  } catch { /* 저장소 접근 불가(사생활 보호 모드 등) — 토큰 없이 보냄 */ }
  return config;
});

export default client;
