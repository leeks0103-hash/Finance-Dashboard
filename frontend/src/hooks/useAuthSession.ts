import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUiStore } from '@/store';
import { setUnauthorizedHandler } from '@/api/client';
import {
  loginAdmin, verifySession, getStoredExtractKey, getStoredRole, setStoredExtractAuth, clearStoredExtractAuth,
} from '@/api/extract.api';
import { clearDataCaches } from '@/hooks/useLoginRequired';

type Status = 'checking' | 'out' | 'in';

/**
 * 들어가자마자 로그인(2026-10-13) — 로그인 전엔 앱(=모든 조회)을 아예 안 그림. 서버도 데이터 API를 401로 막음.
 * 계정은 .env ADMIN_ACCOUNTS(관리자)·USER_ACCOUNTS(일반 회원), DB 없음. 로그인 상태는 ui.store.authRole 하나로 —
 * ⚙ 로그아웃·토큰 무효(401)도 이 값을 null로 바꾸면 로그인 화면으로 돌아옴.
 *
 * - status: 'checking'(저장된 토큰 확인 중) → 'in' / 'out'
 * - showLogin: 로그인 화면을 그리는지 — 로그인 성공 뒤 화면이 걷히는 동안은 남아 있음(dismissLogin으로 끝)
 */
export const useAuthSession = (loginRequired: boolean) => {
  const qc = useQueryClient();
  const authRole    = useUiStore(s => s.authRole);
  const setAuthRole = useUiStore(s => s.setAuthRole);
  const [status, setStatus]       = useState<Status>(() => (getStoredExtractKey() ? 'checking' : 'out'));
  const [showLogin, setShowLogin] = useState(() => loginRequired && !getStoredExtractKey());

  // 저장된 토큰이 아직 유효한지 처음 한 번 — 비밀번호가 바뀌었거나 계정이 빠졌으면 로그인 화면.
  // 역할도 서버 기준으로 다시 받음(.env에서 관리자 ↔ 일반이 바뀌었을 수 있어서).
  // 서버에 못 닿으면(null) 저장된 역할로 일단 들여보냄(서버 재시작 중 등 — 401이 오면 그때 돌아옴)
  useEffect(() => {
    if (status !== 'checking') return;
    verifySession().then(res => {
      if (res === false) {
        clearStoredExtractAuth();
        setShowLogin(loginRequired);
        setStatus('out');
        return;
      }
      const role = res ? res.role : (getStoredRole() ?? 'user');
      if (res) setStoredExtractAuth(getStoredExtractKey(), res.name, res.role);
      setAuthRole(role);
      setStatus('in');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 로그아웃·토큰 무효 → 로그인 화면. 다음 사람이 이전 화면 데이터를 못 보게 캐시도 비움
  // (로그인 요구가 꺼져 있으면 누구나 보는 화면이라 그대로 둠 — 관리자 전용 캐시는 extractJob.logout이 지움)
  useEffect(() => {
    if (!loginRequired) return;
    if (status === 'in' && !authRole) {
      setStatus('out');
      setShowLogin(true);
      clearDataCaches(qc);
    }
  }, [status, authRole, loginRequired, qc]);

  // 관리자가 로그인 요구를 켜거나 끄면(2026-10-22) — 꺼지면 로그인 화면을 거두고, 켜졌는데 로그인 안 한 사람은
  // 로그인 화면으로(그때까지 로그인 없이 받아 둔 데이터는 비움)
  useEffect(() => {
    if (!loginRequired) { setShowLogin(false); return; }
    if (status === 'out') {
      setShowLogin(true);
      clearDataCaches(qc);
    }
  }, [loginRequired, status, qc]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearStoredExtractAuth();
      setAuthRole(null);
    });
    return () => setUnauthorizedHandler(null);
  }, [setAuthRole]);

  const login = useCallback(async (empNo: string, password: string): Promise<boolean> => {
    const r = await loginAdmin(empNo, password);
    if (!r.ok || !r.token || !r.role) return false;
    setStoredExtractAuth(r.token, r.name ?? empNo, r.role);
    setAuthRole(r.role);
    setStatus('in');   // 로그인 화면 뒤에서 앱이 먼저 데이터를 받기 시작 — 화면은 dismissLogin 때 드러남
    return true;
  }, [setAuthRole]);

  return {
    status,
    showLogin,
    login,
    dismissLogin: useCallback(() => setShowLogin(false), []),
  };
};
