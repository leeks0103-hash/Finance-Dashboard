import { useSummary } from '@/hooks/useSummary';
import { KpiCard } from '@/components/ui';
import { formatBillion, formatRate } from '@/utils';
import styles from './KpiSection.module.css';

const KpiSection = () => {
  const { data, isLoading } = useSummary();

  if (isLoading || !data) return (
    <div className={styles.grid}>
      {[0,1,2,3].map(i => <div key={i} className={styles.skeleton} />)}
    </div>
  );

  return (
    <div className={styles.grid}>
      <KpiCard accent="brand"  icon="↑" label="총매출"     value={formatBillion(data.total_revenue)} />
      <KpiCard accent="loss"   icon="↓" label="지출합계"   value={formatBillion(data.total_expenditure)} />
      <KpiCard accent="profit" icon="₩" label="경상이익"   value={formatBillion(data.total_profit)} />
      <KpiCard accent="warn"   icon="%" label="평균 이익율" value={formatRate(data.avg_profit_rate)} />
    </div>
  );
};

export default KpiSection;
