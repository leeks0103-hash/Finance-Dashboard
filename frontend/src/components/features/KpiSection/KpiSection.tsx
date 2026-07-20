import { useKpiViewModel } from '@/hooks/viewmodels';
import { KpiCard } from '@/components/ui';
import styles from './KpiSection.module.css';

/**
 * KpiSection
 * - 훅: useKpiViewModel() — 데이터 fetch, 포맷, null 처리 담당
 * - 컴포넌트: 렌더링만. 비즈니스 로직 없음.
 */
const KpiSection = () => {
  const vm = useKpiViewModel();

  if (vm.isLoading) return (
    <div className={styles.grid}>
      {[0,1,2,3].map(i => <div key={i} className={styles.skeleton} />)}
    </div>
  );

  return (
    <div className={styles.grid}>
      <KpiCard accent="brand"  icon="↑" label="총매출"     value={vm.revenue} />
      <KpiCard accent="loss"   icon="↓" label="지출합계"   value={vm.expenditure} />
      <KpiCard accent="profit" icon="₩" label="경상이익"   value={vm.profit} />
      <KpiCard accent="warn"   icon="%" label="평균 이익율" value={vm.rate} />
    </div>
  );
};

export default KpiSection;
