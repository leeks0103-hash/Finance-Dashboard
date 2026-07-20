import { SuspenseSection } from '@/components/SuspenseSection';
import KpiSection from '@/components/features/KpiSection';
import ChartSection from '@/components/features/ChartSection';
import InsightSection from '@/components/features/InsightSection';
import ProjectTable from '@/components/features/ProjectTable';
import styles from './Dashboard.module.css';

const Dashboard = () => (
  <main className={styles.main}>
    <SuspenseSection label="KPI 로딩 중…">
      <KpiSection />
    </SuspenseSection>

    <SuspenseSection label="차트 로딩 중…">
      <ChartSection />
    </SuspenseSection>

    <SuspenseSection label="인사이트 분석 중…">
      <InsightSection />
    </SuspenseSection>

    <SuspenseSection label="데이터 로딩 중…">
      <ProjectTable />
    </SuspenseSection>
  </main>
);

export default Dashboard;
