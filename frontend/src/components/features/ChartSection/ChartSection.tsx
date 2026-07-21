import { useChartViewModel } from '@/hooks/viewmodels';
import { BarChart, DoughnutChart, EmptyState } from '@/components/ui';
import styles from './ChartSection.module.css';

/**
 * ChartSection
 * - 훅: useChartViewModel() — 데이터 fetch, 차트용 labels/datasets 변환 담당
 * - 컴포넌트: 렌더링만. 숫자 변환 로직 없음.
 */
const ChartSection = () => {
  const vm = useChartViewModel();

  if (vm.isLoading) return (
    <div className={styles.grid}>
      {[0,1,2].map(i => <div key={i} className={styles.skeleton} />)}
    </div>
  );

  if (vm.isEmpty) return (
    <EmptyState icon="📊" title="차트 데이터 없음" description="필터 조건에 해당하는 데이터가 없습니다." />
  );

  return (
    <div className={styles.grid}>
      <div className={styles.card}>
        <div className={styles.title}>파트별 매출 / 지출</div>
        <div className={styles.chartWrap}>
          <BarChart
            horizontal
            labels={vm.revExp.labels}
            datasets={[
              { label: '매출(억)', data: vm.revExp.revenues, backgroundColor: 'rgba(54,132,235,0.75)' },
              { label: '이익(억)', data: vm.revExp.profits,  backgroundColor: 'rgba(5,150,105,0.75)' },
            ]}
          />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.title}>원가 구성</div>
        <div className={styles.chartWrap}>
          <DoughnutChart
            labels={vm.costBreakdown.labels}
            data={vm.costBreakdown.values}
          />
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.title}>파트별 이익율(%)</div>
        <div className={styles.chartWrap}>
          <BarChart
            labels={vm.profitRate.labels}
            datasets={[{
              label: '이익율(%)',
              data: vm.profitRate.rates,
              backgroundColor: vm.profitRate.colors,
            }]}
            options={{ scales: { y: { ticks: { callback: v => v + '%' } } } }}
          />
        </div>
      </div>
    </div>
  );
};

export default ChartSection;
