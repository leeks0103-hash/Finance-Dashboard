import { lazy, Suspense } from 'react';
import { Navbar, FilterBar } from '@/layouts';
import { Spinner } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import styles from './App.module.css';

const Dashboard = lazy(() => import('@/pages/Dashboard'));

const App = () => (
  <div className={styles.root}>
    <Navbar />
    <FilterBar />
    <ErrorBoundary>
      <Suspense fallback={<Spinner size="lg" fullPage label="대시보드 로딩 중…" />}>
        <Dashboard />
      </Suspense>
    </ErrorBoundary>
  </div>
);

export default App;
