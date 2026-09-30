import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from '@/layouts';
import { TabLayout } from '@/layouts';
import { FileOpenVisibleContext } from '@/components/ui';
import { useFileOpenVisible } from '@/hooks/useFileOpenVisible';
import styles from './App.module.css';

const App = () => {
  const fileOpenVisible = useFileOpenVisible();
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

export default App;
