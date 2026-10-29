import { useMemo, type ReactNode } from 'react';
import type { ChartDataset, ChartOptions } from 'chart.js';
import { ChartCard, BarChart, DoughnutChart, InfoButton, FilterChip } from '@/components/ui';
import CostFilterPopover from '@/components/features/PerformanceChartSection/CostFilterPopover';
import { useTheme } from '@/hooks';
import { useUiStore } from '@/store';
import { useChartPalette } from '@/hooks/useChartPalette';
import { makeBarOptions } from '@/utils/chartOptions';
import { getChartTheme } from '@/utils/chartColors';
import type { PlanChartData, PerformancePlanViewModel } from '@/hooks/viewmodels/usePerformancePlanViewModel';
import styles from './PerformancePlanChartSection.module.css';

interface Props {
  chart:       PlanChartData | null;
  composition: PerformancePlanViewModel['compositionView'];
}

const INFO_MONTHLY = '1~12월 값은 실적이 아니라 시트에 입력된 27 사업계획의 월별 분배입니다(기준월·실적 누계 없음). 팀·파트 필터 적용.';
const INFO_COMPOSITION = '27 계획 매출의 구성 — 직접원가 + 인건비 + 공통원가 + 관리비 + 경상손익 = 매출(경상손익이 마이너스면 왼쪽으로). ' +
  '파이는 하나씩 보는 용도(전체·팀·파트를 이 카드에서 따로 선택), 막대는 파트 전체를 나란히 비교하는 용도. 막대는 상단 팀·파트 필터를 따름.';
const INFO_PVP = '파트별 매출 합계 — 26 연간 추정(시트의 "2026년 연간 추정" 열)과 27 사업계획을 나란히. 막대 끝 % = 27 계획 ÷ 26 추정(백엔드 계산). 팀·파트 필터 적용.';
const infoPerHead = (what: string) =>
  `파트별 27 계획 ${what} ÷ 파트 인원 — 인원은 관리자가 수기 입력한 **2027 인원**(관리자 페이지 > 파트별 인원 > 2027년 인원, 2026 인원과 따로)입니다. ` +
  '인원이 입력되지 않은 파트, 팀 필터를 걸었을 때 여러 팀에 걸친 파트(K뉴딜TF)는 제외합니다. 억 단위 소수 둘째 자리(버림).';

/**
 * 2027 사업계획 보기 차트(2026-10-29) — 위에서부터
 *   ①② 한 줄 6칸씩: 월별 계획 분배 · 파트별 27 계획 매출 구성(파이 ↔ 누적 막대 전환, 파이는 전체·팀·파트 선택)
 *   ③ 한 줄 4칸: 파트별 26 추정 vs 27 계획 매출 · 인당 매출 · 인당 관리비 · 인당 손익 (실적 보기 3줄째와 같은 순서)
 * 실적 보기의 진도율·달성률·인원 카드는 기준월·실적이 있어야 의미가 있어 없음. 수치는 전부 억 단위로 받음(VM 변환).
 */
const PerformancePlanChartSection = ({ chart, composition }: Props) => {
  const palette = useChartPalette();
  const showLabels = useUiStore(s => s.showChartLabels);
  const isAdmin = useUiStore(s => s.adminAuthed);   // 인당 차트 빈 상태 안내가 관리자에게만 입력 위치를 알려줌
  const { theme } = useTheme();
  const { labelColor, gridColor, tickColor } = getChartTheme(theme === 'dark');

  const scales = useMemo(() => ({
    x: { grace: '15%', grid: { color: gridColor }, ticks: { color: tickColor } },
    y: { grace: '15%', grid: { color: gridColor }, ticks: { color: tickColor } },
  }), [gridColor, tickColor]);
  const eokTick = useMemo(() => ({ callback: (v: string | number) => `${v}억` }), []);

  const monthlyOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    layout: { padding: { top: 24 } },
    plugins: {
      datalabels: {
        anchor: 'end', align: 'end',
        display: (ctx: { chart: { width: number } }) => showLabels && ctx.chart.width / 24 > 30,
        formatter: (v: number) => `${v}억`,
      },
    },
    scales: { x: scales.x, y: { ...scales.y, ticks: { ...scales.y.ticks, ...eokTick } } },
  } as Partial<ChartOptions<'bar'>>), [showLabels, labelColor, scales, eokTick]);

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
      x: { ...scales.x, stacked: true, ticks: { ...scales.x.ticks, ...eokTick } },
      y: { ...scales.y, stacked: true },
    },
  } as Partial<ChartOptions<'bar'>>), [showLabels, labelColor, scales, eokTick]);

  // 3칸짜리 좁은 카드라 수치 자리(오른쪽 여백)를 줄임
  const pvpOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    layout: { padding: { right: 96 } },
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
    scales: { x: { ...scales.x, ticks: { ...scales.x.ticks, ...eokTick } }, y: scales.y },
  } as Partial<ChartOptions<'bar'>>), [showLabels, labelColor, scales, eokTick, chart?.revRates]);

  const perHeadOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    layout: { padding: { right: 64, left: 40 } },
    plugins: {
      datalabels: { anchor: 'end', align: 'end', formatter: (v: number | null) => (v == null ? null : `${v.toFixed(2)}억`) },
    },
    scales: { x: scales.x, y: scales.y },
  } as Partial<ChartOptions<'bar'>>), [showLabels, labelColor, scales]);

  if (!chart) return <div className={styles.empty}>표시할 계획 데이터가 없습니다</div>;

  const doughnutColors = [palette.costDirect, palette.costLabor, palette.costOverhead, palette.costMgmt, palette.costProfit];
  const compositionSets: ChartDataset<'bar'>[] = [
    { label: '직접원가(억)', data: chart.composition.direct,   backgroundColor: palette.costDirect },
    { label: '인건비(억)',   data: chart.composition.labor,    backgroundColor: palette.costLabor },
    { label: '공통원가(억)', data: chart.composition.overhead, backgroundColor: palette.costOverhead },
    { label: '관리비(억)',   data: chart.composition.mgmt,     backgroundColor: palette.costMgmt },
    { label: '경상손익(억)', data: chart.composition.profit,   backgroundColor: palette.costProfit },
  ];

  const isPie = composition.mode === 'pie';
  // 파이 범위 문구 — 어느 범위를 보고 있는지 제목 옆에 한눈에
  const pieScope = composition.team || (composition.part !== '전체' ? composition.part : '전체');

  // 인당 카드 공통 틀 — 인원이 하나도 없으면 안내, 일부만 없으면 제목 옆에 빠진 파트 수(마우스를 올리면 이름)
  const perHeadCard = (title: string, what: string, values: number[], color: string): ReactNode => {
    const { labels, missingParts, partialParts } = chart.perCapita;
    const skipped = [...missingParts, ...partialParts];
    const tip = [
      missingParts.length ? `인원 미입력: ${missingParts.join(', ')}` : '',
      partialParts.length ? `팀 필터로 인당 값을 못 구함: ${partialParts.join(', ')}` : '',
    ].filter(Boolean).join(' / ');
    return (
      <div className={`${styles.card} ${styles.span3}`}>
        <ChartCard expandable={false}>
          <ChartCard.Title>
            <span className={styles.chartTitle}>{title}<InfoButton>{infoPerHead(what)}</InfoButton></span>
            {skipped.length > 0 && labels.length > 0 && (
              <span className={styles.titleNote} title={tip}>{skipped.length}개 파트 제외</span>
            )}
          </ChartCard.Title>
          <ChartCard.Body>
            {labels.length === 0
              ? <div className={styles.empty}>
                  {partialParts.length > 0 && missingParts.length === 0
                    ? '팀 필터 중에는 여러 팀에 걸친 파트의 인당 값을 구할 수 없습니다'
                    : isAdmin
                      ? '2027 파트 인원이 아직 입력되지 않았습니다 — 관리자 페이지 > 파트별 인원 > 2027년 인원에서 입력하세요'
                      : '2027 파트 인원이 아직 입력되지 않았습니다'}
                </div>
              : <BarChart horizontal labels={labels} datasets={[{ label: `${title}(억)`, data: values, backgroundColor: color }]} options={perHeadOptions} />}
          </ChartCard.Body>
        </ChartCard>
      </div>
    );
  };

  return (
    <div className={styles.grid}>
      {/* ① 월별 계획 분배 — ②와 한 줄(6칸씩, 2026-10-29 요청. 1024px 이하는 위아래로) */}
      <div className={`${styles.card} ${styles.span6}`}>
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

      {/* ② 파트별 27 계획 매출 구성 — 파이(하나씩) ↔ 누적 막대(파트 비교). 파이는 전체·팀·파트를 이 카드에서 따로 고름 */}
      <div className={`${styles.card} ${styles.span6}`}>
        <ChartCard
          expandable={false}
          titleAside={
            <span className={styles.compControls}>
              <span className={styles.compChips}>
                <FilterChip label="파이" checked={isPie} onChange={() => composition.setMode('pie')} />
                <FilterChip label="막대" checked={!isPie} onChange={() => composition.setMode('bar')} />
              </span>
              {isPie && (
                <CostFilterPopover
                  teams={composition.teams}
                  selectedTeam={composition.team}
                  onTeamChange={composition.setTeam}
                  parts={composition.parts}
                  selectedPart={composition.part}
                  onPartChange={composition.setPart}
                />
              )}
            </span>
          }
        >
          <ChartCard.Title>
            <span className={styles.chartTitle}>
              {isPie ? `파트별 27 계획 매출 구성 — ${pieScope}` : '파트별 27 계획 매출 구성'}
              <InfoButton>{INFO_COMPOSITION}</InfoButton>
            </span>
          </ChartCard.Title>
          <ChartCard.Body>
            {isPie
              ? <div className={styles.pieWrap}>
                  <DoughnutChart
                    labels={composition.pie.labels}
                    data={composition.pie.values}
                    colors={doughnutColors}
                    showLabels={showLabels}
                    outsideLabels
                    outsideLabelsSize="md"
                  />
                </div>
              : <BarChart horizontal labels={chart.partLabels} datasets={compositionSets} options={compositionOptions} />}
          </ChartCard.Body>
        </ChartCard>
      </div>

      {/* ③ 한 줄 4칸 — 실적 보기 3줄째와 같은 순서: 계획 vs 추정 · 인당 매출 · 인당 관리비 · 인당 손익 */}
      <div className={`${styles.card} ${styles.span3}`}>
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
      {perHeadCard('파트별 인당 매출', '매출', chart.perCapita.revenue, palette.revenue)}
      {perHeadCard('파트별 인당 관리비', '관리비', chart.perCapita.mgmt, palette.costMgmt)}
      {perHeadCard('파트별 인당 손익', '경상손익', chart.perCapita.profit, palette.costProfit)}
    </div>
  );
};

export default PerformancePlanChartSection;
