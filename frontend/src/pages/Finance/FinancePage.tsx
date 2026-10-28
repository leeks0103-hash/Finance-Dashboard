import { FadeInSection } from '@/components/FadeInSection';
import { RefreshSpinner } from '@/components/ui';
import { useFinancePageViewModel } from '@/hooks/viewmodels';
import KpiSection   from '@/components/features/KpiSection';
import ChartSection from '@/components/features/ChartSection';
import PartTable    from '@/components/features/PartTable';
import ProjectTable from '@/components/features/ProjectTable';
import styles from './FinancePage.module.css';

const FinancePage = () => {
  // 상단 필터 변경 → 요약 재조회 동안 요약 섹션은 살짝 흐리게 + 페이지 위에 스피너
  // (프로젝트 재무 상세 표는 자체 흐림이 있어 따로 안 흐림)
  const vm = useFinancePageViewModel();
  return (
    <main className={styles.main}>
      <FadeInSection delay={0} refreshing={vm.isRefreshing}><KpiSection /></FadeInSection>
      <FadeInSection delay={100} refreshing={vm.isRefreshing}><ChartSection /></FadeInSection>
      <FadeInSection delay={150} refreshing={vm.isRefreshing}><PartTable /></FadeInSection>
      <FadeInSection delay={200}><ProjectTable /></FadeInSection>
      <RefreshSpinner active={vm.isRefreshing} />
    </main>
  );
};

export default FinancePage;
