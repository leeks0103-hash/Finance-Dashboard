import { useMemo } from 'react';
import type { ChartDataset, ChartOptions } from 'chart.js';
import { ChartCard, BarChart, InfoButton } from '@/components/ui';
import { useTheme } from '@/hooks';
import { useUiStore } from '@/store';
import { useChartPalette } from '@/hooks/useChartPalette';
import { makeBarOptions } from '@/utils/chartOptions';
import { getChartTheme } from '@/utils/chartColors';
import type { PlanChartData } from '@/hooks/viewmodels/usePerformancePlanViewModel';
import styles from './PerformancePlanChartSection.module.css';

interface Props {
  chart: PlanChartData | null;
}

const INFO_PVP = '2027년 사업계획 시트의 파트별 매출 합계 — 26 연간 추정(Z열)과 27 사업계획(AS열)을 나란히. 막대 끝 % = 27 계획 ÷ 26 추정(백엔드 계산). 팀·파트 필터 적용.';
const INFO_COMPOSITION = '파트별 27 계획 매출의 구성 — 직접원가 + 인건비 + 공통원가 + 관리비 + 경상손익 = 매출(경상손익이 마이너스면 왼쪽으로). 팀·파트 필터 적용.';
const INFO_MONTHLY = '1~12월 값은 실적이 아니라 시트에 입력된 27 사업계획의 월별 분배입니다(기준월·실적 누계 없음). 팀·파트 필터 적용.';

/**
 * 2027 사업계획 보기 차트(2026-10-29) — 파트별 26 추정 vs 27 계획 매출 · 파트별 27 계획 구성 · 월별 계획 분배.
 * 실적 보기의 진도율·달성률·인당·인원 차트는 기준월·실적이 있어야 의미가 있어 이 보기에는 없음. 수치는 전부 억 단위로 받음(VM 변환).
 */
const PerformancePlanChartSection = ({ chart }: Props) => {
  const palette = useChartPalette();
  const showLabels = useUiStore(s => s.showChartLabels);
  const { theme } = useTheme();
  const { labelColor, gridColor, tickColor } = getChartTheme(theme === 'dark');

  const scales = useMemo(() => ({
    x: { grace: '15%', grid: { color: gridColor }, ticks: { color: tickColor } },
    y: { grace: '15%', grid: { color: gridColor }, ticks: { color: tickColor } },
  }), [gridColor, tickColor]);

  const pvpOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    layout: { padding: { right: 112 } },
    plugins: {
      datalabels: {
        anchor: 'end', align: 'end',
        // 27 계획 막대(데이터셋 1) 끝에만 26 대비 % — 26 막대는 값만
        formatter: (v: number, ctx: { dataIndex: number; datasetIndex: number }) => {
          const rate = ctx.datasetIndex === 1 ? chart?.revRates[ctx.dataIndex] : null;
          return rate != null ? `${v}억 (${rate}%)` : `${v}억`;
        },
      },
    },
    scales: { x: { ...scales.x, ticks: { ...scales.x.ticks, callback: (v: string | number) => `${v}억` } }, y: scales.y },
  } as Partial<ChartOptions<'bar'>>), [showLabels, labelColor, scales, chart?.revRates]);

  const compositionOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    plugins: {
      datalabels: {
        anchor: 'center', align: 'center', color: '#fff',
        // 좁은 조각은 수치를 생략(겹침 방지)
        display: (ctx: { dataset: { data: unknown[] }; dataIndex: number }) =>
          showLabels && Math.abs(Number(ctx.dataset.data[ctx.dataIndex])) >= 6,
        formatter: (v: number) => `${v}억`,
      },
    },
    scales: {
      x: { ...scales.x, stacked: true, ticks: { ...scales.x.ticks, callback: (v: string | number) => `${v}억` } },
      y: { ...scales.y, stacked: true },
    },
  } as Partial<ChartOptions<'bar'>>), [showLabels, labelColor, scales]);

  const monthlyOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    layout: { padding: { top: 24 } },
    plugins: {
      datalabels: {
        anchor: 'end', align: 'end',
        display: (ctx: { chart: { width: number } }) => showLabels && ctx.chart.width / 24 > 30,
        formatter: (v: number) => `${v}억`,
      },
    },
    scales: { x: scales.x, y: { ...scales.y, ticks: { ...scales.y.ticks, callback: (v: string | number) => `${v}억` } } },
  } as Partial<ChartOptions<'bar'>>), [showLabels, labelColor, scales]);

  if (!chart) return <div className={styles.empty}>표시할 계획 데이터가 없습니다</div>;

  const compositionSets: ChartDataset<'bar'>[] = [
    { label: '직접원가(억)', data: chart.composition.direct,   backgroundColor: palette.costDirect },
    { label: '인건비(억)',   data: chart.composition.labor,    backgroundColor: palette.costLabor },
    { label: '공통원가(억)', data: chart.composition.overhead, backgroundColor: palette.costOverhead },
    { label: '관리비(억)',   data: chart.composition.mgmt,     backgroundColor: palette.costMgmt },
    { label: '경상손익(억)', data: chart.composition.profit,   backgroundColor: palette.costProfit },
  ];

  return (
    <div className={styles.grid}>
      <div className={`${styles.card} ${styles.span6}`}>
        <ChartCard expandable={false}>
          <ChartCard.Title>
            <span className={styles.chartTitle}>파트별 26 추정 매출 vs 27 계획 매출<InfoButton>{INFO_PVP}</InfoButton></span>
          </ChartCard.Title>
          <ChartCard.Body>
            <BarChart
              horizontal
              labels={chart.partLabels}
              datasets={[
                { label: '26 추정(억)', data: chart.rev26, backgroundColor: palette.plan },
                { label: '27 계획(억)', data: chart.rev27, backgroundColor: palette.revenue },
              ]}
              options={pvpOptions}
            />
          </ChartCard.Body>
        </ChartCard>
      </div>

      <div className={`${styles.card} ${styles.span6}`}>
        <ChartCard expandable={false}>
          <ChartCard.Title>
            <span className={styles.chartTitle}>파트별 27 계획 매출 구성<InfoButton>{INFO_COMPOSITION}</InfoButton></span>
          </ChartCard.Title>
          <ChartCard.Body>
            <BarChart horizontal labels={chart.partLabels} datasets={compositionSets} options={compositionOptions} />
          </ChartCard.Body>
        </ChartCard>
      </div>

      <div className={`${styles.card} ${styles.span12}`}>
        <ChartCard expandable={false}>
          <ChartCard.Title>
            <span className={styles.chartTitle}>월별 계획 분배 (매출 · 원가)<InfoButton>{INFO_MONTHLY}</InfoButton></span>
          </ChartCard.Title>
          <ChartCard.Body>
            <BarChart
              labels={chart.monthLabels}
              datasets={[
                { label: '매출(억)', data: chart.monthRevenue, backgroundColor: palette.revenue },
                { label: '원가(억)', data: chart.monthCost,    backgroundColor: palette.cost },
              ]}
              options={monthlyOptions}
            />
          </ChartCard.Body>
        </ChartCard>
      </div>
    </div>
  );
};

export default PerformancePlanChartSection;
