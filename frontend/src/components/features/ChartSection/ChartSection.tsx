import { useChartViewModel } from '@/hooks/viewmodels';
import { ChartCard, BarChart, DoughnutChart, EmptyState, Toggle } from '@/components/ui';
import styles from './ChartSection.module.css';

const ChartSection = () => {
  const vm = useChartViewModel();

  if (vm.isLoading) return (
    <div className={styles.grid}>
      {[0, 1, 2].map(i => <div key={i} className={styles.skeleton} />)}
    </div>
  );

  if (vm.isEmpty) return (
    <EmptyState icon="📊" title="차트 데이터 없음" description="필터 조건에 해당하는 데이터가 없습니다." />
  );

  return (
    <>
      <div className={styles.toolbar}>
        <Toggle
          checked={vm.showLabels}
          onChange={vm.toggleLabels}
        />
      </div>

      <div className={styles.grid}>
        <ChartCard>
          <ChartCard.Title>파트별 이익율(%)</ChartCard.Title>
          <ChartCard.Body>
            <BarChart
              labels={vm.profitRate.labels}
              datasets={[{
                label: '이익율(%)',
                data:  vm.profitRate.rates,
                backgroundColor: vm.profitRate.colors,
              }]}
              options={vm.profitRate.options}
            />
          </ChartCard.Body>
        </ChartCard>

        <ChartCard>
          <ChartCard.Title>파트별 매출 / 지출</ChartCard.Title>
          <ChartCard.Body>
            <BarChart
              horizontal
              labels={vm.revExp.labels}
              datasets={[
                { label: '매출(억)', data: vm.revExp.revenues, backgroundColor: 'rgba(54,132,235,0.75)' },
                { label: '이익(억)', data: vm.revExp.profits,  backgroundColor: 'rgba(5,150,105,0.75)' },
              ]}
              options={vm.revExp.options}
            />
          </ChartCard.Body>
        </ChartCard>

        <ChartCard>
          <ChartCard.Title>원가 구성</ChartCard.Title>
          <ChartCard.Body>
            <DoughnutChart
              labels={vm.costBreakdown.labels}
              data={vm.costBreakdown.values}
              showLabels={vm.showLabels}
            />
          </ChartCard.Body>
        </ChartCard>
      </div>
    </>
  );
};

export default ChartSection;
