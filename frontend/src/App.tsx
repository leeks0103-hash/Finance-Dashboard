import { useQuery } from '@tanstack/react-query';
import { getProjects } from './api/finance.api';
import FilterPanel from './components/features/FilterPanel';
import KpiSection from './components/features/KpiSection';
import ChartSection from './components/features/ChartSection';
import InsightSection from './components/features/InsightSection';
import ProjectTable from './components/features/ProjectTable';
import ActionBar from './components/features/ActionBar';
import styles from './App.module.css';

const App = () => {
  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects-all'],
    queryFn: () => getProjects({ year: '', parts: [], stages: [] }),
    staleTime: Infinity,
  });

  const years  = [...new Set(allProjects.map(r => r.year).filter(Boolean))].sort();
  const parts  = [...new Set(allProjects.map(r => r.part).filter(Boolean))].sort();
  const stages = [...new Set(allProjects.map(r => r.stage).filter(Boolean))].sort();

  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        <span className={styles.brand}>📊 프로젝트 재무 대시보드</span>
        <span className={styles.team}>기술교육사업기획팀</span>
      </nav>

      <div className={styles.filterBar}>
        <FilterPanel years={years} parts={parts} stages={stages} />
        <ActionBar />
      </div>

      <main className={styles.main}>
        <KpiSection />
        <ChartSection />
        <InsightSection />
        <ProjectTable />
      </main>
    </div>
  );
};

export default App;
