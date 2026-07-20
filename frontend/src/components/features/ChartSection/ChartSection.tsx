import { useSummary } from '@/hooks/useSummary';
import { BarChart, DoughnutChart, EmptyState } from '@/components/ui';
import styles from './ChartSection.module.css';

const ChartSection = () => {
  const { data, isLoading } = useSummary();

  if (isLoading || !data) return (
    <div className={styles.grid}>
      {[0,1,2].map(i => <div key={i} className={styles.skeleton} />)}
    </div>
  );

  const parts = Object.keys(data.by_part);
  if (parts.length === 0) return (
    <EmptyState icon="📊" title="차트 데이터 없음" description="필터 조건에 해당하는 데이터가 없습니다." />
  );

  const revenues = parts.map(p => +(data.by_part[p].revenue / 1e8).toFixed(2));
  const profits  = parts.map(p => +(data.by_part[p].profit  / 1e8).toFixed(2));
  const rates    = parts.map(p => +(data.by_part[p].profit / (data.by_part[p].revenue || 1) * 100).toFixed(1));
  const cb = data.cost_breakdown;

  return (
    <div className={styles.grid}>
      <div className={styles.card}>
        <div className={styles.title}>파트별 매출 / 지출</div>
        <div className={styles.chartWrap}>
          <BarChart horizontal labels={parts} datasets={[
            { label: '매출(억)', data: revenues, backgroundColor: 'rgba(54,132,235,0.75)' },
            { label: '이익(억)', data: profits,  backgroundColor: 'rgba(5,150,105,0.75)' },
          ]} />
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.title}>원가 구성</div>
        <div className={styles.chartWrap}>
          <DoughnutChart
            labels={['직접원가','직접인건비','공통원가/관리비']}
            data={[cb.direct_cost, cb.labor_cost, cb.overhead].map(v => +(v/1e4).toFixed(0))}
          />
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.title}>파트별 이익율(%)</div>
        <div className={styles.chartWrap}>
          <BarChart labels={parts} datasets={[{
            label: '이익율(%)',
            data: rates,
            backgroundColor: rates.map(v => v >= 0 ? 'rgba(5,150,105,0.75)' : 'rgba(220,38,38,0.75)'),
          }]} options={{ scales: { y: { ticks: { callback: v => v + '%' } } } }} />
        </div>
      </div>
    </div>
  );
};

export default ChartSection;
