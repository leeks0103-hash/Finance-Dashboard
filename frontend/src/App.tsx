import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from '@/layouts';
import { TabLayout } from '@/layouts';
import { FileOpenVisibleContext } from '@/components/ui';
import { LoginScreen } from '@/components/features/LoginScreen';
import { useVisible } from '@/hooks/useVisibility';
import { useAuthSession } from '@/hooks/useAuthSession';
import styles from './App.module.css';

// 로그인한 뒤에만 그림 — 조회 훅이 전부 여기 아래라 로그인 전엔 데이터 요청이 한 건도 안 나감
const Dashboard = () => {
  const fileOpenVisible = useVisible('fileOpen');
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
  const auth = useAuthSession();
  return (
    <>
      {auth.status === 'in' && <Dashboard />}
      {auth.showLogin && <LoginScreen onLogin={auth.login} onDone={auth.dismissLogin} />}
    </>
  );
};

export default App;
