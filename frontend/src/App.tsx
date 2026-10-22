import { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from '@/layouts';
import { TabLayout } from '@/layouts';
import { FileOpenVisibleContext } from '@/components/ui';
import { LoginScreen } from '@/components/features/LoginScreen';
import { useVisible } from '@/hooks/useVisibility';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useLoginRequired } from '@/hooks/useLoginRequired';
import styles from './App.module.css';

// 로그인한 뒤에만 그림 — 조회 훅이 전부 여기 아래라 로그인 전엔 데이터 요청이 한 건도 안 나감
const Dashboard = () => {
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
  // 값이 오기 전엔 로그인 화면을 그릴지 몰라 비워 둠(잠깐) — 서버가 안 닿으면 '요구함'으로 처리
  if (isLoading) return null;
  return (
    <>
      {/* 로그인 요구가 꺼져 있으면 로그인 화면 없이 바로 대시보드 */}
      {(!loginRequired || auth.status === 'in') && <Dashboard />}
      {loginRequired && auth.showLogin && <LoginScreen onLogin={auth.login} onDone={auth.dismissLogin} />}
    </>
  );
};

export default App;
