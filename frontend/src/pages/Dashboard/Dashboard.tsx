import { ErrorBoundary } from '@/components/ErrorBoundary';
import KpiSection from '@/components/features/KpiSection';
import ChartSection from '@/components/features/ChartSection';
import InsightSection from '@/components/features/InsightSection';
import ProjectTable from '@/components/features/ProjectTable';
import styles from './Dashboard.module.css';

// 각 섹션은 자체 isLoading + skeleton으로 레이아웃을 고정합니다.
// ErrorBoundary는 예외 발생 시 섹션별로 격리합니다.
const Dashboard = () => (
  <main className={styles.main}>
    <ErrorBoundary><KpiSection /></ErrorBoundary>
    <ErrorBoundary><ChartSection /></ErrorBoundary>
    <ErrorBoundary><InsightSection /></ErrorBoundary>
    <ErrorBoundary><ProjectTable /></ErrorBoundary>
  </main>
);

export default Dashboard;
