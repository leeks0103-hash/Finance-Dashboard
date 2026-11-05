// import { lazy, Suspense, useMemo } from 'react';   // 관리자 페이지를 다시 켤 때 lazy·Suspense도 같이 복구
import { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from '@/layouts';
import { TabLayout } from '@/layouts';
import { FileOpenVisibleContext, Spinner } from '@/components/ui';
import { LoginScreen } from '@/components/features/LoginScreen';
import AdminRoute from '@/components/features/Admin/AdminRoute';
import { useVisible } from '@/hooks/useVisibility';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useLoginRequired } from '@/hooks/useLoginRequired';
import styles from './App.module.css';

// 관리자 페이지(#/admin)는 2026-10-29에 주석 처리 — 관리자 기능은 다시 모달(AdminModal)로. 페이지 파일(pages/Admin)은 그대로 둠(나중에 다시 쓸 수 있게).
// 복구하려면 이 줄과 아래 "관리자 페이지" 라우트 주석을 풀고, 위 react import도 lazy·Suspense 버전으로
// // 관리자 페이지(#/admin) — 관리자만 쓰는 큰 화면이라 처음 열 때 불러옴(2026-10-23, 예전 ⚙ > 관리자 기능 모달)
// const AdminPage = lazy(() => import('@/pages/Admin'));

// 로그인한 뒤에만 그림 — 조회 훅이 전부 여기 아래라 로그인 전엔 데이터 요청이 한 건도 안 나감
const Dashboard = ({ authChecking }: { authChecking: boolean }) => {
  const fileVisible = useVisible('fileOpen');
  const folderVisible = useVisible('folderOpen');
  const requestVisible = useVisible('extractRequest');
  const fileOpenVisible = useMemo(
    () => ({ file: fileVisible, folder: folderVisible, request: requestVisible }),
    [fileVisible, folderVisible, requestVisible],
  );
  return (
    <FileOpenVisibleContext.Provider value={fileOpenVisible}>
      <div className={styles.root}>
        <Navbar />
        <Routes>
          <Route path="/" element={<Navigate to="/performance" replace />} />
          {/* 관리자 로그인 입구만 남김(2026-10-29) — 관리자 페이지는 주석 처리, 관리자 기능은 상단 바 관리자 아이콘의 모달(AdminModal).
              로그인 요구가 꺼져 있으면 AdminRoute가 관리자 로그인 폼을 보여 주고(유일한 입구), 관리자면 첫 화면으로 보냄 */}
          <Route path="/admin" element={
            <AdminRoute authChecking={authChecking}>
              <Navigate to="/performance" replace />
            </AdminRoute>
          } />
          <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
          {/* [관리자 페이지 — 주석 처리, 복구용] 위 /admin 라우트 대신 이 블록을 쓰면 됨
          <Route path="/admin" element={
            <AdminRoute authChecking={authChecking}>
              <Suspense fallback={null}><AdminPage /></Suspense>
            </AdminRoute>
          } />
          */}
          <Route path="/*" element={<TabLayout />} />
        </Routes>
      </div>
    </FileOpenVisibleContext.Provider>
  );
};

const App = () => {
  // 로그인을 요구하는지는 관리자 기능 토글(서버 저장, 2026-10-22) — 예전엔 코드 상수(LOGIN_REQUIRED)를 주석으로 껐다 켰음
  const { loginRequired, isLoading } = useLoginRequired();
  const auth = useAuthSession(loginRequired);
  // 값이 오기 전엔 로그인 화면을 그릴지 몰라 대시보드는 못 그림 — 예전엔 null이라 서버 응답이 느리면 완전한 빈 화면이었음.
  // 스피너(0.12초 뒤 나타남 — 빨리 끝나면 안 번쩍임)를 그림(2026-11-04, QA H1 "#/admin 간헐적 빈 화면"). 서버가 안 닿으면 '요구함'으로 처리
  if (isLoading) return <Spinner label="불러오는 중…" />;
  // 저장된 토큰을 확인하는 동안(checking)도 같음 — 확인이 끝나야 대시보드 또는 로그인 화면이 정해짐
  const verifying = loginRequired && auth.status === 'checking';
  return (
    <>
      {verifying && <Spinner label="로그인 확인 중…" />}
      {/* 로그인 요구가 꺼져 있으면 로그인 화면 없이 바로 대시보드 */}
      {(!loginRequired || auth.status === 'in') && <Dashboard authChecking={auth.status === 'checking'} />}
      {loginRequired && auth.showLogin && <LoginScreen onLogin={auth.login} onDone={auth.dismissLogin} />}
    </>
  );
};

export default App;
