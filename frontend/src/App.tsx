import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from '@/layouts';
import { TabLayout } from '@/layouts';
import styles from './App.module.css';

const App = () => (
  <div className={styles.root}>
    <Navbar />
    <Routes>
      <Route path="/" element={<Navigate to="/finance" replace />} />
      <Route path="/*" element={<TabLayout />} />
    </Routes>
  </div>
);

export default App;
