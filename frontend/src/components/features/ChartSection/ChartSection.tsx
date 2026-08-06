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

  // 팔레트 — 오렌지/웜 브랜드에 맞춤
  const labelColor = dark ? 'rgba(212,212,216,0.90)' : '#3F3F46';   // zinc-300 / zinc-700
  const gridColor  = dark ? 'rgba(63,63,70,0.60)'    : 'rgba(0,0,0,0.06)';
  const tickColor  = dark ? 'rgba(161,161,170,0.90)' : '#71717A';   // zinc-400 / zinc-500

  const vm = useChartViewModel(labelColor);

  // 이익율 바: 흑자=인디고, 적자=레드
  const profitColors = useMemo(() => vm.profitRate.isProfit.map(ok =>
    ok
      ? (dark ? 'rgba(129,140,248,0.85)' : 'rgba(79,70,229,0.80)')   // indigo
      : (dark ? 'rgba(248,113,113,0.85)' : 'rgba(220,38,38,0.75)')   // red
  ), [vm.profitRate.isProfit, dark]);

  // 매출=인디고, 이익=에메랄드 — 가독성 최우선
  const barOrange = dark ? 'rgba(129,140,248,0.82)' : 'rgba(79,70,229,0.80)';   // indigo
  const barGreen  = dark ? 'rgba(52,211,153,0.80)'  : 'rgba(5,150,105,0.78)';   // emerald

  // 도넛: 인디고 + 에메랄드 + 앰버
  const doughnutColors = useMemo(() => dark
    ? ['rgba(129,140,248,0.85)', 'rgba(52,211,153,0.82)', 'rgba(251,191,36,0.82)']
    : ['rgba(79,70,229,0.82)',   'rgba(5,150,105,0.80)',  'rgba(217,119,6,0.78)']
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

  // 로그 스케일 사용 시 0이하 값이 있으면 자동 fallback
  const canUseLogScale = vm.showLogScale && vm.profitRate.rates.every(r => r > 0);

  const profitRateOptions = useMemo(() => ({
    ...vm.profitRate.options,
    scales: {
      ...vm.profitRate.options.scales,
      y: {
        ...scaleOverride.y,
        type: canUseLogScale ? ('logarithmic' as const) : ('linear' as const),
        ticks: { ...scaleOverride.y.ticks, callback: (v: string | number) => v + '%' },
      },
    },
  }), [vm.profitRate.options, scaleOverride, canUseLogScale]);

  const yearTrendOptions = useMemo(() => ({
    ...vm.yearTrend.options,
    scales: { ...scaleOverride, x: { ...scaleOverride.x, stacked: false } },
  }), [vm.yearTrend.options, scaleOverride]);

  const stageChartOptions = useMemo(() => ({
    ...vm.stageChart.options,
    scales: { ...scaleOverride, x: { ...scaleOverride.x, stacked: false } },
  }), [vm.stageChart.options, scaleOverride]);

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
                { label: '매출(억)', data: vm.revExp.revenues, backgroundColor: barOrange },
                { label: '이익(억)', data: vm.revExp.profits,  backgroundColor: barGreen  },
              ]}
              options={revExpOptions}
              onClick={handlePartClick}
            />
          </ChartCard.Body>
        </ChartCard>

        {vm.stageChart.labels.length > 0 && (
          <ChartCard>
            <ChartCard.Title>보고단계별 매출 현황</ChartCard.Title>
            <ChartCard.Body>
              <BarChart
                horizontal
                labels={vm.stageChart.labels}
                datasets={[
                  { label: '매출(억)', data: vm.stageChart.revenues, backgroundColor: barOrange },
                ]}
                options={stageChartOptions}
              />
            </ChartCard.Body>
          </ChartCard>
        )}

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
                  { label: '매출(억)', data: vm.yearTrend.revenues, backgroundColor: barOrange },
                  { label: '이익(억)', data: vm.yearTrend.profits,  backgroundColor: barGreen  },
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
