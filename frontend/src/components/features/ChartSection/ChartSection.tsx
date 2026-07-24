import { useMemo, useCallback } from 'react';
import { useChartViewModel } from '@/hooks/viewmodels';
import { useTheme } from '@/hooks';
import { useFilterStore, useUiStore } from '@/store';
import { ChartCard, BarChart, DoughnutChart, EmptyState } from '@/components/ui';
import styles from './ChartSection.module.css';

const ChartSection = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const togglePart    = useFilterStore(s => s.togglePart);
  const showYearChart = useUiStore(s => s.showYearChart);

  const handlePartClick = useCallback((part: string) => {
    togglePart(part);
  }, [togglePart]);

  const labelColor   = dark ? 'rgba(180,230,255,0.9)' : '#1e293b';
  const gridColor    = dark ? 'rgba(0,200,255,0.07)'  : 'rgba(0,0,0,0.06)';
  const tickColor    = dark ? 'rgba(91,168,204,0.80)' : '#334155';  // 라이트: --text-sub 값

  const vm = useChartViewModel(labelColor);

  const profitColors = useMemo(() => vm.profitRate.isProfit.map(ok =>
    ok
      ? (dark ? 'rgba(0,200,255,0.82)'  : 'rgba(5,150,105,0.78)')
      : (dark ? 'rgba(255,68,88,0.88)'  : 'rgba(220,38,38,0.75)')
  ), [vm.profitRate.isProfit, dark]);

  const barBlue  = dark ? 'rgba(0,150,255,0.82)'  : 'rgba(54,132,235,0.78)';
  const barGreen = dark ? 'rgba(0,230,118,0.82)'  : 'rgba(5,150,105,0.78)';

  const doughnutColors = useMemo(() => dark
    ? ['rgba(240,224,64,0.88)', 'rgba(0,200,255,0.82)', 'rgba(180,126,255,0.88)']
    : ['rgba(255,159,64,0.85)', 'rgba(75,192,192,0.85)', 'rgba(153,102,255,0.85)']
  , [dark]);

  // 차트 옵션에 grid/tick 색상 직접 주입 — Chart.defaults 의존 없이 React prop만으로 업데이트
  const scaleOverride = useMemo(() => ({
    x: { grid: { color: gridColor }, ticks: { color: tickColor } },
    y: { grid: { color: gridColor }, ticks: { color: tickColor } },
  }), [gridColor, tickColor]);

  const revExpOptions  = useMemo(() => ({
    ...vm.revExp.options,
    scales: { ...scaleOverride, x: { ...scaleOverride.x, stacked: false } },
  }), [vm.revExp.options, scaleOverride]);

  const profitRateOptions = useMemo(() => ({
    ...vm.profitRate.options,
    scales: {
      ...vm.profitRate.options.scales,
      y: {
        ...scaleOverride.y,
        type: vm.showLogScale ? ('logarithmic' as const) : ('linear' as const),
        ticks: { ...scaleOverride.y.ticks, callback: (v: string | number) => v + '%' },
      },
    },
  }), [vm.profitRate.options, scaleOverride, vm.showLogScale]);

  const yearTrendOptions = useMemo(() => ({
    ...vm.yearTrend.options,
    scales: { ...scaleOverride, x: { ...scaleOverride.x, stacked: false } },
  }), [vm.yearTrend.options, scaleOverride]);

  if (vm.isLoading) return (
    <div className={styles.grid}>
      {[0, 1, 2, ...(showYearChart ? [3] : [])].map(i => <div key={i} className={styles.skeleton} />)}
    </div>
  );

  if (vm.isEmpty) return (
    <EmptyState icon="📊" title="차트 데이터 없음" description="필터 조건에 해당하는 데이터가 없습니다." />
  );

  return (
    <>
      {/* tk: 테마 전환 시 차트 완전 리마운트 → 색상 보장 업데이트 + 입장 애니메이션 */}
      <div className={styles.grid} key={dark ? 'dark' : 'light'}>
        <ChartCard>
          <ChartCard.Title>파트별 이익율(%)</ChartCard.Title>
          <ChartCard.Body>
            <BarChart
              labels={vm.profitRate.labels}
              datasets={[{ label: '이익율(%)', data: vm.profitRate.rates, backgroundColor: profitColors }]}
              options={profitRateOptions}
              onClick={handlePartClick}
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
                { label: '매출(억)', data: vm.revExp.revenues, backgroundColor: barBlue  },
                { label: '이익(억)', data: vm.revExp.profits,  backgroundColor: barGreen },
              ]}
              options={revExpOptions}
              onClick={handlePartClick}
            />
          </ChartCard.Body>
        </ChartCard>

        <ChartCard>
          <ChartCard.Title>원가 구성</ChartCard.Title>
          <ChartCard.Body>
            <DoughnutChart
              labels={vm.costBreakdown.labels}
              data={vm.costBreakdown.values}
              colors={doughnutColors}
              showLabels={vm.showLabels}
              labelColor={labelColor}
            />
          </ChartCard.Body>
        </ChartCard>

        {showYearChart && vm.yearTrend.labels.length > 0 && (
          <ChartCard>
            <ChartCard.Title>연도별 매출 / 이익 추이</ChartCard.Title>
            <ChartCard.Body>
              <BarChart
                labels={vm.yearTrend.labels}
                datasets={[
                  { label: '매출(억)', data: vm.yearTrend.revenues, backgroundColor: barBlue  },
                  { label: '이익(억)', data: vm.yearTrend.profits,  backgroundColor: barGreen },
                ]}
                options={yearTrendOptions}
              />
            </ChartCard.Body>
          </ChartCard>
        )}
      </div>
    </>
  );
};

export default ChartSection;
