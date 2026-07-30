import { ErrorBoundary } from '@/components/ErrorBoundary';
import KpiSection     from '@/components/features/KpiSection';
import ChartSection   from '@/components/features/ChartSection';
import InsightSection from '@/components/features/InsightSection';
import ProjectTable   from '@/components/features/ProjectTable';
import styles from './FinancePage.module.css';

const FinancePage = () => (
  <main className={styles.main}>
    <div className="fadeUp" style={{ animationDelay: '0ms' }}>
      <ErrorBoundary><KpiSection /></ErrorBoundary>
    </div>
    <div className="fadeUp" style={{ animationDelay: '100ms' }}>
      <ErrorBoundary><ChartSection /></ErrorBoundary>
    </div>
    <div className="fadeUp" style={{ animationDelay: '200ms' }}>
      <ErrorBoundary><InsightSection /></ErrorBoundary>
    </div>
    <div className="fadeUp" style={{ animationDelay: '300ms' }}>
      <ErrorBoundary><ProjectTable /></ErrorBoundary>
    </div>
  </main>
);

export default FinancePage;
