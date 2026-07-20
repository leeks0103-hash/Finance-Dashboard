import { useSummary } from '../../../hooks/useSummary';
import KpiCard from '../../ui/KpiCard';
import { formatBillion, formatRate } from '../../../utils/format';
import styles from './KpiSection.module.css';

const KpiSection = () => {
  const { data, isLoading } = useSummary();

  if (isLoading) return <div className={styles.skeleton} />;

  const d = data;
  return (
    <div className={styles.grid}>
      <KpiCard accent="brand"  icon="↑" label="총매출"     value={d ? formatBillion(d.total_revenue)    : '-'} />
      <KpiCard accent="loss"   icon="↓" label="지출합계"   value={d ? formatBillion(d.total_expenditure): '-'} />
      <KpiCard accent="profit" icon="₩" label="경상이익"   value={d ? formatBillion(d.total_profit)     : '-'} />
      <KpiCard accent="warn"   icon="%" label="평균 이익율" value={d ? formatRate(d.avg_profit_rate)     : '-'} />
    </div>
  );
};

export default KpiSection;
