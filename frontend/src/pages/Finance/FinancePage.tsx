import { FadeInSection } from '@/components/FadeInSection';
import KpiSection   from '@/components/features/KpiSection';
import ChartSection from '@/components/features/ChartSection';
import PartTable    from '@/components/features/PartTable';
import ProjectTable from '@/components/features/ProjectTable';
import styles from './FinancePage.module.css';

const FinancePage = () => (
  <main className={styles.main}>
    <FadeInSection delay={0}><KpiSection /></FadeInSection>
    <FadeInSection delay={100}><ChartSection /></FadeInSection>
    <FadeInSection delay={150}><PartTable /></FadeInSection>
    <FadeInSection delay={200}><ProjectTable /></FadeInSection>
  </main>
);

export default FinancePage;
