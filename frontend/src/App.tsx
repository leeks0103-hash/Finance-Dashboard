import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from '@/layouts';
import { TabLayout } from '@/layouts';
import TabRemote from '@/components/ui/TabRemote/TabRemote';
import styles from './App.module.css';

const App = () => (
  <div className={styles.root}>
    <Navbar />
    <Routes>
      <Route path="/" element={<Navigate to="/finance" replace />} />
      <Route path="/*" element={<TabLayout />} />
    </Routes>
    <TabRemote />
  </div>
);

export default App;
