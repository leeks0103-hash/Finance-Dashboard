import { useMemo, type CSSProperties, type ReactNode } from 'react';
import type { Chart, ChartDataset, ChartOptions, Plugin } from 'chart.js';
import { ChartCard, BarChart, DoughnutChart, InfoButton, FilterChip } from '@/components/ui';
import CostFilterPopover from '@/components/features/PerformanceChartSection/CostFilterPopover';
// 2026 실적 보기와 같은 플러그인·조절표를 그대로 씀(2026-10-29) — 글자 크기·자간·두 줄 파트명·여백이 두 해에서 달라지지 않게
import {
  costRatePlugin, tightLabelsPlugin, tightTicksPlugin, fitBarLabelsPlugin, breakAtDotTick, costRateTuning,
  INLINE_COST_RATE, costRateText,
} from '@/components/features/PerformanceChartSection/PerformanceChartSection';
import { CHART_TUNING, tuningBarSize, tuningLabelFont, tuningTickFont, px } from '@/components/features/PerformanceChartSection/chartTuning';
import { useTheme } from '@/hooks';
import { useUiStore } from '@/store';
import { useChartPalette } from '@/hooks/useChartPalette';
import { formatHeadcount } from '@/utils/format';
// 파트별 인원 카드는 2026 실적 보기와 같은 CSS(알약 목록)를 그대로 씀 — 한 곳에서만 고치면 두 해가 같이 바뀜
import actualStyles from '@/components/features/PerformanceChartSection/PerformanceChartSection.module.css';
import { makeBarOptions } from '@/utils/chartOptions';
import { getChartTheme } from '@/utils/chartColors';
import { getDatalabelAlpha } from '@/utils/datalabelFade';
import type { PlanChartData, PerformancePlanViewModel } from '@/hooks/viewmodels/usePerformancePlanViewModel';
import styles from './PerformancePlanChartSection.module.css';

interface Props {
  chart:       PlanChartData | null;
  composition: PerformancePlanViewModel['compositionView'];
}

const INFO_MONTHLY = '1~12월 값은 실적이 아니라 시트에 입력된 27 사업계획의 월별 분배입니다(기준월·실적 누계 없음). 팀·파트 필터 적용. ' +
  '원가 막대 위 % = 원가율 = 원가 ÷ 매출(원가는 직접원가), 제목 옆 숫자는 27 계획 연간 합계.';
const INFO_COMPOSITION = '27 계획 매출의 구성 — 직접원가 + 인건비 + 공통원가 + 관리비 + 경상손익 = 매출(경상손익이 마이너스면 왼쪽으로). ' +
  '막대 안 % = 그 항목 ÷ 매출, 막대 끝 (%) = 원가율 = 원가(직접+공통) ÷ 매출. ' +
  '파이는 하나씩 보는 용도(전체·팀·파트를 이 카드에서 따로 선택), 막대는 파트 전체를 나란히 비교하는 용도. 막대는 상단 팀·파트 필터를 따름.';
const INFO_PVP = '파트별 매출 합계 — 26 연간 추정(시트의 "2026년 연간 추정" 열)과 27 사업계획을 나란히. 막대 끝 % = 27 계획 ÷ 26 추정(백엔드 계산). 팀·파트 필터 적용.';
const infoPerHead = (what: string) =>
  `파트별 27 계획 ${what} ÷ 파트 인원 — 인원은 관리자가 수기 입력한 **2027 인원**(관리자 페이지 > 파트별 인원 > 2027년 인원, 2026 인원과 따로)입니다. ` +
  '인원이 입력되지 않은 파트, 팀 필터를 걸었을 때 여러 팀에 걸친 파트(K뉴딜TF)는 제외합니다. 억 단위 소수 둘째 자리(버림).';

const COMP_KEYS = ['direct', 'labor', 'overhead', 'mgmt', 'profit'] as const;
const COMP_MIN_SEG_PX = 44;   // 구성 막대 칸이 이보다 짧으면 안 쪽 수치를 생략(겹침 방지)

// 구성 막대 끝의 원가율 "(45.8%)" — 실적 원가분석 차트의 막대 위 원가율과 같은 글꼴·색, 가로 막대용(막대 오른쪽 끝에 붙임).
// 값은 백엔드가 계산해 옵션(plugins.partRate.rates, 파트 순서)으로 넘김
interface PartRateOpts { show: boolean; rates: (number | null)[]; color: string; font: string }
const partRatePlugin: Plugin<'bar'> = {
  id: 'partRate',
  afterDatasetsDraw(chart) {
    const o = (chart.options.plugins as { partRate?: PartRateOpts } | undefined)?.partRate;
    if (!o?.show) return;
    const { ctx } = chart;
    ctx.save();
    ctx.globalAlpha = getDatalabelAlpha();
    ctx.font = o.font;
    ctx.fillStyle = o.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const n = chart.data.labels?.length ?? 0;
    for (let i = 0; i < n; i++) {
      const rate = o.rates[i];
      if (rate == null) continue;
      // 막대 끝 = 보이는 칸 중 가장 오른쪽 x
      let right = -Infinity;
      let y = 0;
      chart.data.datasets.forEach((_, di) => {
        if (!chart.isDatasetVisible(di)) return;
        const el = chart.getDatasetMeta(di).data[i] as unknown as { x: number; y: number } | undefined;
        if (el && el.x > right) { right = el.x; y = el.y; }
      });
      if (right === -Infinity) continue;
      ctx.fillText(`(${rate}%)`, right + 6, y);
    }
    ctx.restore();
  },
};

type PerHeadId = 'perCapitaRevenue' | 'perCapitaMgmt' | 'perCapitaProfit';

/**
 * 2027 사업계획 보기 차트(2026-10-29) — 위에서부터
 *   ①② 한 줄 8 : 4칸(실적 보기 원가분석 : 원가 비율과 같은 비율): 월별 계획 분배 · 파트별 27 계획 매출 구성(파이 ↔ 누적 막대 전환, 파이는 전체·팀·파트 선택)
 *   파트별 인원(2027 인원) — 실적 보기와 같은 자리·모양의 한 줄 카드
 *   ③ 한 줄 4칸: 파트별 26 추정 vs 27 계획 매출 · 인당 매출 · 인당 관리비 · 인당 손익 (실적 보기 3줄째와 같은 순서)
 * 실적 보기의 진도율·달성률·인원 카드는 기준월·실적이 있어야 의미가 있어 없음. 수치는 전부 억 단위로 받음(VM 변환).
 * 글자 크기·자간·여백·막대 굵기·두 줄 파트명은 2026 실적 차트와 **같은 조절표(chartTuning.ts)·같은 플러그인**을 읽음 —
 *   월별 = monthly, 구성·26 vs 27 = planVsActual, 인당 3개 = perCapita* (그쪽 값을 바꾸면 두 해가 같이 바뀜)
 */
const PerformancePlanChartSection = ({ chart, composition }: Props) => {
  const palette = useChartPalette();
  const showLabels = useUiStore(s => s.showChartLabels);
  const isAdmin = useUiStore(s => s.adminAuthed);   // 인당 차트 빈 상태 안내가 관리자에게만 입력 위치를 알려줌
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { labelColor, gridColor, tickColor } = getChartTheme(dark);
  const rateColor = dark ? 'rgb(0,170,210)' : 'rgb(0,119,147)';   // 원가율 글자색 — 실적 차트와 같음

  const scales = useMemo(() => ({
    x: { grace: '15%', grid: { color: gridColor }, ticks: { color: tickColor } },
    y: { grace: '15%', grid: { color: gridColor }, ticks: { color: tickColor } },
  }), [gridColor, tickColor]);
  const eokTick = useMemo(() => ({ callback: (v: string | number) => `${v}억` }), []);

  // ① 월별 — 2026 진도율(월별 실적 추이)과 같은 조절표 monthly + 원가 막대 위 원가율(costRatePlugin)
  const monthlyOptions = useMemo(() => {
    const t = CHART_TUNING.monthly;
    const base = makeBarOptions(showLabels, labelColor, {
      plugins: {
        datalabels: {
          anchor: 'end', align: 'end',
          display: (ctx: { chart: { width: number } }) => showLabels && ctx.chart.width / 24 > 30,
          font: tuningLabelFont(t),
          textAlign: 'center',
          // 원가 막대(데이터셋 1) 수치 아래 줄에 원가율 — 같은 글자색, 2026 진도율과 같은 방식(INLINE_COST_RATE)
          formatter: (v: number, ctx: { chart: Chart; datasetIndex: number; dataIndex: number }) => {
            const t = `${v}억`;
            const r = INLINE_COST_RATE && ctx.datasetIndex === 1 ? costRateText(ctx.chart, ctx.dataIndex) : null;
            return r ? [t, r] : t;
          },
        },
      },
    } as Partial<ChartOptions<'bar'>>);
    return {
      ...base,
      layout: { padding: t.padding },
      datasets: tuningBarSize(t),
      plugins: {
        ...base.plugins,
        costRate: { show: showLabels && !INLINE_COST_RATE, text: rateColor, ...costRateTuning(t) },
        tightLabels: { spacing: px(t.labelSpacing) },
        tightTicks: { spacing: px(t.tickSpacing), axes: ['x'] as ('x' | 'y')[] },
      },
      scales: {
        x: { ...scales.x, ticks: { ...scales.x.ticks, ...tuningTickFont(t) } },
        y: { ...scales.y, ticks: { ...scales.y.ticks, ...tuningTickFont(t), ...eokTick } },
      },
    } as ChartOptions<'bar'>;
  }, [showLabels, labelColor, scales, eokTick, rateColor]);

  // ② 구성(누적 가로 막대) — 파트가 왼쪽 축이라 파트별 가로 막대 조절표(planVsActual)를 씀. 칸 안 수치 = "N억 / P%"(매출 대비), 막대 끝 = 원가율
  const compositionOptions = useMemo(() => {
    const t = CHART_TUNING.planVsActual;
    const base = makeBarOptions(showLabels, labelColor, {
      plugins: {
        datalabels: {
          anchor: 'center', align: 'center', color: '#fff',
          font: tuningLabelFont(t),
          // 칸이 좁으면 수치를 생략(겹침 방지) — 칸 길이(px)로 판단
          display: (ctx: { chart: { getDatasetMeta: (i: number) => { data: unknown[] } }; datasetIndex: number; dataIndex: number; dataset: { data: unknown[] } }) => {
            if (!showLabels || !(Math.abs(Number(ctx.dataset.data[ctx.dataIndex])) > 0)) return false;
            const el = ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.dataIndex] as { x: number; base: number } | undefined;
            return !!el && Math.abs(el.x - el.base) >= COMP_MIN_SEG_PX;
          },
          formatter: (v: number, ctx: { datasetIndex: number; dataIndex: number }) => {
            const pct = chart?.compositionRates[COMP_KEYS[ctx.datasetIndex]]?.[ctx.dataIndex];
            return pct == null ? `${v}억` : [`${v}억`, `${pct}%`];
          },
        },
      },
    } as Partial<ChartOptions<'bar'>>);
    return {
      ...base,
      // 막대 끝 원가율 "(45.8%)" 자리 = 오른쪽 여백
      layout: { padding: { ...t.padding, right: 60 } },
      datasets: { bar: { categoryPercentage: 0.92, barPercentage: 0.96 } },   // 칸 안 두 줄(억/%)이 들어갈 만큼 막대를 굵게
      plugins: {
        ...base.plugins,
        tightLabels: { spacing: px(t.labelSpacing) },
        tightTicks: { spacing: px(t.tickSpacing), axes: ['y'] as ('x' | 'y')[] },
        partRate: { show: showLabels, rates: chart?.partCostRates ?? [], color: rateColor, font: `bold ${t.labelFontPx}px 'Pretendard', 'Malgun Gothic', sans-serif` },
      },
      scales: {
        x: { ...scales.x, stacked: true, ticks: { ...scales.x.ticks, ...tuningTickFont(t), ...eokTick } },
        y: { ...scales.y, stacked: true, ticks: { ...scales.y.ticks, ...tuningTickFont(t), ...(t.breakTickAtDot ? { callback: breakAtDotTick } : {}) } },
      },
    } as ChartOptions<'bar'>;
  }, [showLabels, labelColor, scales, eokTick, rateColor, chart?.compositionRates, chart?.partCostRates]);

  // ③ 26 추정 vs 27 계획 — 2026 "파트별 계획 vs 추정 매출"(planVsActual)과 같은 조절표·fitBarLabels(수치 자리만큼 축을 늘림)
  const pvpOptions = useMemo(() => {
    const t = CHART_TUNING.planVsActual;
    const base = makeBarOptions(showLabels, labelColor, {
      plugins: {
        datalabels: {
          anchor: 'end', align: 'end',
          font: tuningLabelFont(t),
          // 수치 글자색 = 그 막대 색(26 추정 회색 계열 / 27 계획 매출색) — 실적 보기와 같은 규칙
          color: (ctx: { datasetIndex: number; dataset: { backgroundColor?: unknown }; dataIndex: number }) => {
            if (ctx.datasetIndex === 0) return palette.planLabel;
            const bg = ctx.dataset.backgroundColor;
            return (Array.isArray(bg) ? bg[ctx.dataIndex] : bg) as string;
          },
          // 27 계획 막대(데이터셋 1) 끝에만 26 대비 % — 26 막대는 값만
          formatter: (v: number, ctx: { dataIndex: number; datasetIndex: number }) => {
            const rate = ctx.datasetIndex === 1 ? chart?.revRates[ctx.dataIndex] : null;
            return rate != null ? `${v}억 (${rate}%)` : `${v}억`;
          },
        },
      },
    } as Partial<ChartOptions<'bar'>>);
    return {
      ...base,
      layout: { padding: t.padding },
      datasets: tuningBarSize(t),
      plugins: {
        ...base.plugins,
        fitBarLabels: { show: showLabels, showRate: true, fontPx: t.labelFontPx, spacing: t.labelSpacing },
        tightLabels: { spacing: px(t.labelSpacing) },
        tightTicks: { spacing: px(t.tickSpacing), axes: ['y'] as ('x' | 'y')[] },
      },
      scales: {
        x: { ...scales.x, grace: 0, ticks: { ...scales.x.ticks, ...tuningTickFont(t), ...eokTick } },
        y: { ...scales.y, ticks: { ...scales.y.ticks, ...tuningTickFont(t), ...(t.breakTickAtDot ? { callback: breakAtDotTick } : {}) } },
      },
    } as ChartOptions<'bar'>;
  }, [showLabels, labelColor, scales, eokTick, palette.planLabel, chart?.revRates]);

  // ③ 인당 3종 — 2026 인당 차트와 같은 조절표(perCapitaRevenue/Mgmt/Profit)·fitBarLabels. 마이너스 막대가 있을 때만 왼쪽 수치 자리 확보
  const perHeadOptions = useMemo(() => {
    const build = (id: PerHeadId, values: number[]): ChartOptions<'bar'> => {
      const t = CHART_TUNING[id];
      const base = makeBarOptions(showLabels, labelColor, {
        plugins: {
          datalabels: { anchor: 'end', align: 'end', font: tuningLabelFont(t), formatter: (v: number | null) => (v == null ? null : `${v.toFixed(2)}억`) },
        },
      } as Partial<ChartOptions<'bar'>>);
      const hasNegative = values.some(v => v < 0);
      return {
        ...base,
        layout: { padding: { ...t.padding, left: hasNegative && t.leftIfNegative != null ? t.leftIfNegative : t.padding.left } },
        datasets: tuningBarSize(t),
        plugins: {
          ...base.plugins,
          fitBarLabels: { show: showLabels, showRate: false, fontPx: t.labelFontPx, spacing: t.labelSpacing },
          tightLabels: { spacing: px(t.labelSpacing) },
          tightTicks: { spacing: px(t.tickSpacing), axes: ['y'] as ('x' | 'y')[] },
        },
        scales: {
          x: { ...scales.x, grace: 0, ticks: { ...scales.x.ticks, ...tuningTickFont(t), ...eokTick } },
          y: { ...scales.y, ticks: { ...scales.y.ticks, ...tuningTickFont(t), ...(t.breakTickAtDot ? { callback: breakAtDotTick } : {}) } },
        },
      } as ChartOptions<'bar'>;
    };
    const pc = chart?.perCapita;
    return {
      perCapitaRevenue: build('perCapitaRevenue', pc?.revenue ?? []),
      perCapitaMgmt:    build('perCapitaMgmt',    pc?.mgmt ?? []),
      perCapitaProfit:  build('perCapitaProfit',  pc?.profit ?? []),
    };
  }, [showLabels, labelColor, scales, eokTick, chart?.perCapita]);

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
  const mt = chart.monthTotals;

  // 인당 카드 공통 틀 — 인원이 하나도 없으면 안내, 일부만 없으면 제목 옆에 빠진 파트 수(마우스를 올리면 이름)
  const perHeadCard = (id: PerHeadId, title: string, what: string, values: number[], color: string): ReactNode => {
    const { labels, missingParts, partialParts } = chart.perCapita;
    const skipped = [...missingParts, ...partialParts];
    const tip = [
      missingParts.length ? `인원 미입력: ${missingParts.join(', ')}` : '',
      partialParts.length ? `팀 필터로 인당 값을 못 구함: ${partialParts.join(', ')}` : '',
    ].filter(Boolean).join(' / ');
    return (
      <div className={`${styles.card} ${styles.span3}`}>
        <ChartCard expandable={false} bodyBleedX={CHART_TUNING[id].bleedX}>
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
              : <BarChart horizontal labels={labels} datasets={[{ label: `${title}(억)`, data: values, backgroundColor: color }]}
                  options={perHeadOptions[id]} plugins={[fitBarLabelsPlugin, tightTicksPlugin, tightLabelsPlugin]} />}
          </ChartCard.Body>
        </ChartCard>
      </div>
    );
  };

  return (
    <div className={styles.grid}>
      {/* ① 월별 계획 분배 — ②와 한 줄, 실적 보기 2줄째(원가분석 : 원가 비율)와 같은 8 : 4 비율(2026-10-29 요청). 1280px 이하는 위아래로 */}
      <div className={`${styles.card} ${styles.span8}`}>
        <ChartCard expandable={false}>
          <ChartCard.Title>
            <span className={styles.chartTitle}>월별 계획 분배 (매출 · 원가)<InfoButton>{INFO_MONTHLY}</InfoButton></span>
            {/* 27 계획 합계 매출·원가 + 원가율 — 실적 보기 진도율 차트의 "매출/원가 추정 누계 실적"과 같은 자리·모양(계획이라 누계·진행률 대신 합계·원가율) */}
            <span className={styles.cumNote}>
              <span className={styles.cumLabel}>매출/원가 27 계획 합계</span>
              <span className={styles.cumItem} style={{ '--cum-color': palette.revenue } as CSSProperties}>매출 <b>{mt.revenue.toFixed(1)}억</b></span>
              <span className={styles.cumItem} style={{ '--cum-color': palette.cost } as CSSProperties}>원가 <b>{mt.cost.toFixed(1)}억</b>{mt.costRate != null && <i>(원가율 {mt.costRate}%)</i>}</span>
            </span>
            {showLabels && <span className={styles.rateNote}><b className={styles.rateNotePct}>%</b>원가율 = 원가 ÷ 매출</span>}
          </ChartCard.Title>
          <ChartCard.Body>
            <BarChart
              labels={chart.monthLabels}
              datasets={[
                { label: '매출(억)', data: chart.monthRevenue, backgroundColor: palette.revenue, borderRadius: 4 },
                { label: '원가(억)', data: chart.monthCost,    backgroundColor: palette.cost,    borderRadius: 4 },
              ]}
              options={monthlyOptions}
              plugins={[costRatePlugin, tightLabelsPlugin, tightTicksPlugin]}
            />
          </ChartCard.Body>
        </ChartCard>
      </div>

      {/* ② 파트별 27 계획 매출 구성 — 파이(하나씩) ↔ 누적 막대(파트 비교). 파이는 전체·팀·파트를 이 카드에서 따로 고름 */}
      <div className={`${styles.card} ${styles.span4}`}>
        <ChartCard
          expandable={false}
          bodyBleedX={isPie ? undefined : CHART_TUNING.planVsActual.bleedX}
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
            <div className={styles.bodyCol}>
              {/* 4칸 카드라 제목줄에 못 넣는 막대 % 설명 — 차트 위 한 줄(막대 + 그래프 수치 켬일 때만). 파이는 안 보임(요청) */}
              {showLabels && !isPie && (
                <div className={styles.caption}>
                  <b className={styles.rateNotePct}>%</b>
                  원가율 = 원가(직접+공통) ÷ 매출 (막대 끝) · 칸 안 % = 매출 대비
                </div>
              )}
              <div className={styles.bodyFill}>
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
                  : <BarChart horizontal labels={chart.partLabels} datasets={compositionSets} options={compositionOptions}
                      plugins={[partRatePlugin, tightTicksPlugin, tightLabelsPlugin]} />}
              </div>
            </div>
          </ChartCard.Body>
        </ChartCard>
      </div>

      {/* 파트별 인원 — 실적 보기와 같은 자리(차트 줄과 인당 차트 줄 사이)·같은 모양의 한 줄 카드, 값은 2027 인원 */}
      <div className={`${styles.card} ${styles.cardLow} ${styles.span12}`}>
        <ChartCard expandable={false} dense>
          <ChartCard.Title>{null}</ChartCard.Title>
          <ChartCard.Body>
            {chart.headcount.labels.length === 0
              ? <div className={actualStyles.perCapitaEmpty}>
                  {isAdmin
                    ? '2027 파트 인원이 아직 입력되지 않았습니다 — 관리자 페이지 > 파트별 인원 > 2027년 인원에서 입력하세요'
                    : '2027 파트 인원이 아직 입력되지 않았습니다'}
                </div>
              : <div className={actualStyles.headcountRow}>
                  <span className={actualStyles.headcountRowLabel}>파트별 인원 (2027)</span>
                  <ul className={actualStyles.headcountList}>
                    {chart.headcount.labels.map((name, i) => (
                      <li key={name} className={actualStyles.headcountItem}>
                        <span className={actualStyles.headcountName}>{name}</span>
                        <span className={actualStyles.headcountSep}>:</span>
                        <b className={actualStyles.headcountVal}>{formatHeadcount(chart.headcount.current[i])}명</b>
                      </li>
                    ))}
                    <li className={`${actualStyles.headcountItem} ${actualStyles.headcountTotal}`}
                      title={chart.headcount.missingParts.length > 0 ? `인원 미입력 파트: ${chart.headcount.missingParts.join(', ')}` : undefined}>
                      <span className={actualStyles.headcountName}>합계</span>
                      <span className={actualStyles.headcountSep}>:</span>
                      <b className={actualStyles.headcountVal}>{formatHeadcount(chart.headcount.totalCurrent)}명</b>
                    </li>
                  </ul>
                </div>}
          </ChartCard.Body>
        </ChartCard>
      </div>

      {/* ③ 한 줄 4칸 — 실적 보기 3줄째와 같은 순서: 계획 vs 추정 · 인당 매출 · 인당 관리비 · 인당 손익 */}
      <div className={`${styles.card} ${styles.span3}`}>
        <ChartCard expandable={false} bodyBleedX={CHART_TUNING.planVsActual.bleedX}>
          <ChartCard.Title>
            <span className={styles.chartTitle}>파트별 26 추정 매출 vs 27 계획 매출<InfoButton>{INFO_PVP}</InfoButton></span>
          </ChartCard.Title>
          <ChartCard.Body>
            <BarChart
              horizontal
              labels={chart.partLabels}
              datasets={[
                { label: '26 추정(억)', data: chart.rev26, backgroundColor: palette.plan },
                { label: '27 계획(억)', data: chart.rev27, backgroundColor: palette.revenue, rates: chart.revRates } as ChartDataset<'bar'>,
              ]}
              options={pvpOptions}
              plugins={[fitBarLabelsPlugin, tightTicksPlugin, tightLabelsPlugin]}
            />
          </ChartCard.Body>
        </ChartCard>
      </div>
      {perHeadCard('perCapitaRevenue', '파트별 인당 매출', '매출', chart.perCapita.revenue, palette.revenue)}
      {perHeadCard('perCapitaMgmt', '파트별 인당 관리비', '관리비', chart.perCapita.mgmt, palette.costMgmt)}
      {perHeadCard('perCapitaProfit', '파트별 인당 손익', '경상손익', chart.perCapita.profit, palette.costProfit)}
    </div>
  );
};

export default PerformancePlanChartSection;
