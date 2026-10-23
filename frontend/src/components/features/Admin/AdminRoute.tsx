import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUiStore } from '@/store';
import { useLoginRequired } from '@/hooks/useLoginRequired';
import AdminLogin from './AdminLogin';

interface Props {
  /** useAuthSession이 저장된 로그인을 서버에 확인하는 중 — 이때 adminAuthed는 아직 false라 기다려야 관리자가 깜빡 쫓겨나지 않음 */
  authChecking: boolean;
  children: ReactNode;
}

/**
 * 관리자 페이지(#/admin) 가드(2026-10-23). 화면만 막음 — 서버 관리자 API는 따로 403.
 *  · 관리자 → 페이지
 *  · 확인 중 → 아무것도 안 그림
 *  · 로그인 요구가 꺼져 있어 로그인 화면이 없으면 → 관리자 로그인 폼(이 폼이 유일한 관리자 로그인 입구)
 *  · 그 외(일반 회원·로그인 요구가 켜져 있는데 관리자가 아닌 사람) → 첫 화면(실적)으로
 */
const AdminRoute = ({ authChecking, children }: Props) => {
  const isAdmin = useUiStore(s => s.adminAuthed);
  const { loginRequired } = useLoginRequired();

  if (isAdmin) return <>{children}</>;
  if (authChecking) return null;
  if (!loginRequired) return <AdminLogin />;
  return <Navigate to="/performance" replace />;
};

export default AdminRoute;
