import { useChartViewModel } from '@/hooks/viewmodels';
import { BarChart, DoughnutChart, EmptyState } from '@/components/ui';
import styles from './ChartSection.module.css';

// 모듈 레벨 상수 — 매 렌더마다 새 객체 생성 방지
const REV_EXP_OPTIONS = {
  layout: { padding: { right: 52 } },  // 막대 끝 레이블 공간 확보
  plugins: {
    datalabels: {
      display: true,
      anchor: 'end' as const,
      align:  'end'  as const,
      color:  '#111827',              // 진한 검정에 가깝게
      font:   { size: 12, weight: 'bold' as const },
      formatter: (v: number) =>
        Math.abs(v) >= 1 ? `${v.toFixed(1)}억` : `${(v * 10).toFixed(0)}천만`,
    },
  },
} as const;

const PROFIT_RATE_OPTIONS = {
  layout: { padding: { top: 24 } },    // 막대 위 레이블 공간 확보
  plugins: {
    datalabels: {
      display: true,
      anchor: 'end'  as const,
      align:  'top'  as const,
      offset: 2,
      color:  '#111827',
      font:   { size: 12, weight: 'bold' as const },
      formatter: (v: number) => `${v}%`,
    },
  },
  scales: { y: { ticks: { callback: (v: string | number) => v + '%' } } },
} as const;

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
            options={REV_EXP_OPTIONS}
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
            options={PROFIT_RATE_OPTIONS}
          />
        </div>
      </div>
    </div>
  );
};

export default ChartSection;
