import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from '@/layouts';
import { TabLayout } from '@/layouts';
import AiInsightWidget from '@/components/features/AiInsightWidget';
import styles from './App.module.css';

const App = () => (
  <div className={styles.root}>
    <Navbar />
    <Routes>
      <Route path="/" element={<Navigate to="/performance" replace />} />
      <Route path="/*" element={<TabLayout />} />
    </Routes>
    <AiInsightWidget />
  </div>
);

export default App;
