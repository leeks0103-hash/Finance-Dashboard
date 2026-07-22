import { useKpiViewModel } from '@/hooks/viewmodels';
import { KpiCard } from '@/components/ui';
import styles from './KpiSection.module.css';

const KpiSection = () => {
  const vm = useKpiViewModel();

  if (vm.isLoading) return (
    <div className={styles.grid}>
      {[0,1,2,3].map(i => <div key={i} className={styles.skeleton} />)}
    </div>
  );

  return (
    <div className={styles.grid}>
      <KpiCard accent="brand"           label="총매출"     value={vm.revenue} />
      <KpiCard accent="warn"            label="지출합계"   value={vm.expenditure} />
      <KpiCard accent={vm.profitAccent} label="경상이익"   value={vm.profit} />
      <KpiCard accent="purple"          label="평균 이익율" value={vm.rate} />
    </div>
  );
};

export default KpiSection;
