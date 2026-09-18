import { useMemo, useState, useCallback, type ReactNode } from 'react';
import {
  DndContext, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePerformanceChartViewModel } from '@/hooks/viewmodels';
import { useTheme } from '@/hooks';
import { makeBarOptions } from '@/utils/chartOptions';
import { getChartPalette, getChartTheme } from '@/utils/chartColors';
// Toggle — 파트별 경상이익 토글 비활성화로 미사용(주석 처리). 복구 시 함께 import
import { createColumnHelper } from '@tanstack/react-table';
import { ChartCard, BarChart, DoughnutChart, DataTable, Toggle, useTableDndSensors, InfoButton } from '@/components/ui';
import type { Plugin } from 'chart.js';
import CostFilterPopover from './CostFilterPopover';
import PerfBreakdownModal from '@/components/features/PerfBreakdownModal/PerfBreakdownModal';
import CostBreakdownModal from './CostBreakdownModal';
import type { PerfBreakdownTarget } from '@/hooks/viewmodels/usePerfBreakdownViewModel';
import type { PerfBreakdownChart } from '@/api/performance.api';
import {
  INFO_MONTHLY, INFO_PROFIT_RATE, INFO_COST_BREAKDOWN,
  INFO_PLAN_VS_ACTUAL,
} from '@/utils/infoTexts';
import type { ChartOptions } from 'chart.js';
import styles from './PerformanceChartSection.module.css';

// 레이아웃: 월별 실적 추이(전체 너비 1줄) → 파트별 이익율+원가구성(1줄) → 파트별 계획vs실적+진행단계(1줄)
// 'progress'(진행단계별 매출/원가)는 요청에 따라 비활성 — 되살리려면 배열에 다시 넣고 아래 렌더러 주석 해제
const DEFAULT_CHART_ORDER = ['monthly', 'profitRate', 'costBreakdown', 'planVsActual'];
const LS_CHART_ORDER = 'performance-chart-order';
// 항상 한 줄 전체를 차지하는 차트 — 드래그로 순서가 바뀌어도 이 카드가 위치한 줄은 전체 폭 유지
const FULL_ROW_ID = 'monthly';

// 2번째 줄 카드별 고정 폭(12칸 그리드 기준 span). 슬롯이 아니라 '카드'에 붙어서
// 재배치해도 파트별 추정 매출/원가(넓게)는 그대로 넓게 유지된다. 합 = 12.
const SPAN_BY_ID: Record<string, 'spanWide' | 'spanNarrow' | 'spanMid'> = {
  profitRate:    'spanWide',    // 파트별 추정 매출/원가 — 크게
  costBreakdown: 'spanNarrow',  // 원가구성 도넛 — 작게
  planVsActual:  'spanMid',     // 파트별 계획 vs 추정 실적
};

// 파트별 경상이익 카드 전용 여백 — 그래프 면적을 최대한 넓게 쓰기 위해 직접 지정한다.
// makeBarOptions의 최소 여백(right 58 / top 30)은 가로 막대 차트가 막대 오른쪽에 수치를 찍기
// 위한 값이라 세로 막대인 이 차트에서는 낭비된다. resolvePadding이 max()로만 키우므로 여기서 덮어씀.
// bottom은 마이너스 막대의 수치가 막대 아래에 찍히는 것만 감당하면 되므로 최소로 둔다.
const PROFIT_PADDING = { top: 22, right: 12, bottom: 12, left: 4 };

// 이익율/이익액 토글 비활성화로 미사용(주석 처리) — 매출/원가는 항상 0 이상이라 부호 분기 불필요.
// 복구 시 profitRateOptions/profitAmountOptions와 함께 해제
// const PROFIT_LABEL = {
//   anchor: 'end' as const,
//   align:  (ctx: { dataset: { data: unknown[] }; dataIndex: number }) =>
//     (Number(ctx.dataset.data[ctx.dataIndex]) >= 0 ? 'top' : 'bottom'),
//   offset: 6,   // 막대 끝과 수치 사이 간격 — 2는 붙어 보여서 키움 (위/아래 동일 적용)
// };

// "파트별 추정 매출/원가" 확대 모달의 검증용 표 — 컬럼은 상태 의존 없어 모듈 스코프
interface PartRevCostRow { part: string; revenue: number; cost: number; costRate: number | null; profit: number; }
const prc = createColumnHelper<PartRevCostRow>();
const partRevCostColumns = [
  prc.accessor('part',     { header: '파트',        size: 110 }),
  prc.accessor('revenue',  { header: '매출(억)',    size: 100, cell: i => i.getValue().toLocaleString() }),
  prc.accessor('cost',     { header: '원가(억)',    size: 100, cell: i => i.getValue().toLocaleString() }),
  prc.accessor('costRate', { header: '원가율(%)',   size: 100, cell: i => i.getValue() == null ? '—' : `${i.getValue()}%` }),
  prc.accessor('profit',   { header: '매출이익(억)', size: 110, cell: i => i.getValue().toLocaleString() }),
];

// 팔레트의 rgba(...) 문자열 알파값만 교체 — 미래 월/보조 계열 흐림 처리용
const fadeAlpha = (rgba: string, alpha: number) => rgba.replace(/[\d.]+\)$/, `${alpha})`);

// "파트별 추정 매출/원가" 확대 모달의 계획 목표선 — line 타입 데이터셋으로 넣으면 Chart.js가
// 그룹형 막대(매출/원가 2개)의 카테고리 중앙에 점을 찍어서 두 막대 "사이"에 점이 찍히는
// 문제가 있었음(그룹 막대는 중앙 기준 좌우로 나뉘어 그려지는데, line 데이터셋은 그 나눔에
// 참여하지 않고 항상 카테고리 중앙 픽셀을 씀). 대신 캔버스 플러그인으로 실제 렌더링된 막대
// 엘리먼트의 x 픽셀(el.x)을 직접 읽어 그 위에 정확히 겹쳐 그린다 — 특정 막대(barIndex)와
// 항상 픽셀 단위로 정렬됨.
interface PlanLineSeries { barIndex: number; values: (number | null)[]; color: string; dash: number[]; }
const makePlanLinePlugin = (series: PlanLineSeries[]): Plugin<'bar'> => ({
  id: 'planLine',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    series.forEach(({ barIndex, values, color, dash }) => {
      const meta = chart.getDatasetMeta(barIndex);
      const yScale = chart.scales[meta?.yAxisID ?? 'y'];
      if (!meta?.data?.length || !yScale) return;
      const pts = meta.data.map((el, i) => {
        const v = values[i];
        return v == null ? null : { x: (el as unknown as { x: number }).x, y: yScale.getPixelForValue(v) };
      });
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(dash);
      ctx.beginPath();
      let started = false;
      pts.forEach(p => {
        if (!p) { started = false; return; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
      pts.forEach(p => {
        if (!p) return;
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    });
  },
});

// x축 stacked 해제 + 테마(격자·눈금) 색 오버라이드 병합 — 그룹형 바 차트 여러 개가 공유하는 패턴
const withUnstackedTheme = (
  options: ChartOptions<'bar'>,
  scaleOverride: { x: Record<string, unknown>; y: Record<string, unknown> },
): ChartOptions<'bar'> => ({
  ...options,
  scales: { ...scaleOverride, x: { ...scaleOverride.x, stacked: false } },
});

// 드래그 가능 차트 카드 래퍼 — 재무 ChartSection과 동일 패턴(카드 전체가 아닌 그립 아이콘만 드래그)
// spanClassName: 2번째 줄 카드는 폭이 슬롯이 아니라 '카드' 기준(각 카드에 고정 span) —
//   재배치해도 파트별 추정 매출/원가가 좁아지지 않게
interface SortableChartProps { id: string; fullRow?: boolean; spanClassName?: string; children: ReactNode; }
function SortableChart({ id, fullRow, spanClassName, children }: SortableChartProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className={[fullRow ? styles.fullRow : '', spanClassName ?? ''].filter(Boolean).join(' ') || undefined}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        position: 'relative',
      }}
    >
      <div className={styles.dragHandle} {...attributes} {...listeners} aria-label="차트 순서 이동" title="드래그하여 순서 변경">
        ⠿
      </div>
      {children}
    </div>
  );
}

// 로딩/에러/데이터없음 플레이스홀더 — 실제 차트와 같은 id 목록·span을 그대로 써서 레이아웃을
// 맞춘다. 예전엔 카드 span 없이 고정 개수(5)만 찍어서, 2번째 줄(카드 3개, span 5+3+4=12)이
// 에러/빈 상태가 되면 각 칸이 span 없는 기본 1칸으로 쪼그라들어 오른쪽이 텅 비어 보였음
interface ChartStateGridProps { variant: 'skeleton' | 'error' | 'empty'; icon?: string; message?: string; ids: string[]; }
function ChartStateGrid({ variant, icon, message, ids }: ChartStateGridProps) {
  return (
    <>
      {ids.map(id => {
        const full = id === FULL_ROW_ID;
        const spanClassName = full ? '' : (styles[SPAN_BY_ID[id] ?? 'spanMid'] ?? '');
        const className = [full ? styles.fullRow : '', spanClassName].filter(Boolean).join(' ');
        return variant === 'skeleton' ? (
          <div key={id} className={`${styles.skeleton} ${className}`} />
        ) : (
          <div key={id} className={`${variant === 'error' ? styles.errorCard : styles.emptyCard} ${className}`}>
            <span className={variant === 'error' ? styles.errorIcon : styles.emptyIcon}>{icon}</span>
            <span>{message}</span>
          </div>
        );
      })}
    </>
  );
}

const PerformanceChartSection = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  // 파트별 경상이익 카드 — 매출/원가 2계열 고정 표시로 변경(담당자 지정) — 토글 비활성화, 복구 시 아래 주석 해제
  // const [showProfitAmount, setShowProfitAmount] = useState(true);

  const { labelColor, gridColor, tickColor } = getChartTheme(dark);

  const vm = usePerformanceChartViewModel();

  // 막대 클릭 → 드릴다운 모달. 축 라벨 클릭(datasetIndex -1)은 첫 시리즈로.
  const [breakdown, setBreakdown] = useState<PerfBreakdownTarget | null>(null);
  // "파트별 추정 매출/원가"의 x축 라벨 클릭 — 다른 차트처럼 드릴다운을 여는 대신, 그 파트를
  // 차트에서 숨김/복원 토글(다시 클릭하면 되돌아옴). 데이터가 많아 복잡할 때 걸러보기 위함
  const [hiddenParts, setHiddenParts] = useState<Set<string>>(new Set());
  // "파트별 추정 매출/원가" 확대 모달 전용 — 계획 목표선(매출/원가 계획) 오버레이 온오프
  const [showPlanLine, setShowPlanLine] = useState(true);
  const openBreakdown = useCallback(
    (chart: PerfBreakdownChart) => (key: string, dsIndex: number) =>
      setBreakdown({ chart, series: dsIndex < 0 ? 0 : dsIndex, key }),
    [],
  );

  const [chartOrder, setChartOrder] = useState<string[]>(() => {
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(LS_CHART_ORDER) ?? '[]');
      const valid = saved.filter(id => DEFAULT_CHART_ORDER.includes(id));
      const added = DEFAULT_CHART_ORDER.filter(id => !valid.includes(id));
      return valid.length ? [...valid, ...added] : DEFAULT_CHART_ORDER;
    } catch { return DEFAULT_CHART_ORDER; }
  });

  const dndSensors = useTableDndSensors();

  const handleChartDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setChartOrder(prev => {
      const next = arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id)));
      localStorage.setItem(LS_CHART_ORDER, JSON.stringify(next));
      return next;
    });
  }, []);

  const palette = useMemo(() => getChartPalette(dark), [dark]);

  // "계획" 막대 — 중립색(실적/원가 계열과 겹치지 않게). KPI "26년 목표" 막대와 같은 값
  const planColor = palette.plan;

  // 이익율/이익액 토글 비활성화로 미사용(주석 처리) — 복구 시 함께 해제
  // const profitColors = useMemo(() => vm.profitRate.isProfit.map(ok =>
  //   ok ? palette.rate : palette.loss
  // ), [vm.profitRate.isProfit, palette]);

  const doughnutColors = useMemo(
    // 직접원가·인건비·공통원가(파랑 3톤) + 관리비(Gold) + 경상손익(Red — 3파랑/골드와 구분되는 유일한 브랜드 액센트)
    () => [palette.costDirect, palette.costLabor, palette.costOverhead, palette.costMgmt, palette.loss],
    [palette],
  );

  // grace: 최댓값 위(아래)로 여유를 둬서 막대가 축 천장에 딱 붙지 않게 함
  // (예: 최대 5억 → 축 상한 6억). 값 축이 세로/가로 어느 쪽이든 잡히도록 x·y 둘 다 지정 —
  // 카테고리 축에서는 grace 가 무시되므로 부작용 없음
  const scaleOverride = useMemo(() => ({
    x: { grace: '15%', grid: { color: gridColor }, ticks: { color: tickColor } },
    y: { grace: '15%', grid: { color: gridColor }, ticks: { color: tickColor } },
  }), [gridColor, tickColor]);

  const monthlyOptions = useMemo(() => ({
    ...vm.monthly.options,
    scales: {
      x: { ...scaleOverride.x },
      y: { ...scaleOverride.y, ticks: { ...scaleOverride.y.ticks, callback: (v: string | number) => v + '억' } },
    },
  }), [vm.monthly.options, scaleOverride]);

  const planVsActualOptions = useMemo(
    () => withUnstackedTheme(vm.planVsActual.options, scaleOverride),
    [vm.planVsActual.options, scaleOverride],
  );

  // 이익율/이익액 토글 비활성화로 미사용(주석 처리) — 복구 시 PROFIT_LABEL과 함께 해제
  // const profitRateOptions = useMemo(() => ({
  //   ...vm.profitRate.options,
  //   layout: { padding: PROFIT_PADDING },
  //   plugins: {
  //     ...vm.profitRate.options.plugins,
  //     legend: { display: false },
  //     // 이익율/이익액 두 모드가 같은 라벨 스타일·위치를 쓰도록 통일 (색은 makeBarOptions의 labelColor)
  //     datalabels: { ...vm.profitRate.options.plugins?.datalabels, ...PROFIT_LABEL },
  //   },
  //   scales: {
  //     ...vm.profitRate.options.scales,
  //     y: {
  //       ...scaleOverride.y,
  //       type: 'linear' as const,
  //       ticks: { ...scaleOverride.y.ticks, callback: (v: string | number) => v + '%' },
  //     },
  //   },
  // }), [vm.profitRate.options, scaleOverride]);

  // const profitAmountOptions = useMemo(() => ({
  //   ...makeBarOptions(vm.showLabels, labelColor, {
  //     plugins: {
  //       legend: { display: false },
  //       datalabels: { ...PROFIT_LABEL, formatter: (v: number) => `${v}억` },
  //     },
  //   }),
  //   layout: { padding: PROFIT_PADDING },   // makeBarOptions의 최소 여백을 통째로 대체
  //   scales: { ...scaleOverride, y: { ...scaleOverride.y, ticks: { ...scaleOverride.y.ticks, callback: (v: string | number) => v + '억' } } },
  // }), [vm.showLabels, labelColor, scaleOverride]);

  // 파트별 경상이익 카드 — 매출/원가 2계열(모두 0 이상)이라 월별 실적 추이 차트와 같은 방식으로
  // 표시(anchor/align 'end', 부호 분기 불필요). 그룹형 막대라 stacked 해제
  const partRevCostOptions = useMemo(() => ({
    ...withUnstackedTheme(makeBarOptions(vm.showLabels, labelColor, {
      layout: { padding: { ...PROFIT_PADDING, top: 36 } },
      plugins: {
        datalabels: {
          // makeBarOptions 기본(13px)보다 살짝만 작게 — 이전엔 10px로 너무 작게 오버라이드돼
          // 있었고, 기본값 그대로 쓰니 이 차트(파트 수 많고 막대 2개씩)에서는 조금 커서 재조정
          anchor: 'end',
          align: 'end',
          offset: 2,
          font: { size: 11, weight: 'bold', family: "'HyundaiSans', 'Malgun Gothic', sans-serif" },
          formatter: (v: number) => `${v}억`,
        },
      },
    }), scaleOverride),
    scales: {
      x: { ...scaleOverride.x, stacked: false, offset: true, ticks: { ...scaleOverride.x.ticks, align: 'center' as const } },
      y: { ...scaleOverride.y, ticks: { ...scaleOverride.y.ticks, callback: (v: string | number) => v + '억' } },
    },
  }), [vm.showLabels, labelColor, scaleOverride]);

  // "파트별 추정 매출/원가" 확대 모달 전용 — 차트 밑에 원본 수치 표를 같이 보여줘서
  // 막대를 하나씩 클릭하지 않아도 전체 파트를 한 번에 검증할 수 있게 함 (2026-09-15 시범)
  const partRevCostRows = useMemo(
    () => vm.profitRate.labels.map((part, i) => {
      const revenue = vm.profitRate.revenues[i];
      const cost    = vm.profitRate.costs[i];
      return {
        part, revenue, cost,
        costRate: revenue > 0 ? +(cost / revenue * 100).toFixed(1) : null,
        profit:   +(revenue - cost).toFixed(1),
      };
    }),
    [vm.profitRate.labels, vm.profitRate.revenues, vm.profitRate.costs],
  );

  // progress 차트 비활성으로 미사용 — 복구 시 함께 주석 해제
  // const progressOptions = useMemo(
  //   () => withUnstackedTheme(vm.progress.options, scaleOverride),
  //   [vm.progress.options, scaleOverride],
  // );

  const chartRenderers: Record<string, () => ReactNode | null> = {
    monthly: () => (
      <ChartCard>
        <ChartCard.Title><span className={styles.chartTitle}>월별 실적 추이<InfoButton>{INFO_MONTHLY}</InfoButton></span></ChartCard.Title>
        <ChartCard.Body>
          <BarChart
            onClick={openBreakdown('monthly')}
            labels={vm.monthly.labels}
            datasets={[
              {
                label: '매출', data: vm.monthly.revenues,
                backgroundColor: vm.monthly.revenues.map((_, i) => vm.monthly.isFuture[i] ? fadeAlpha(palette.revenue, 0.25) : palette.revenue),
                borderRadius: 4,
              },
              {
                label: '원가', data: vm.monthly.costs,
                backgroundColor: vm.monthly.costs.map((_, i) => vm.monthly.isFuture[i] ? fadeAlpha(palette.cost, 0.25) : palette.cost),
                borderRadius: 4,
              },
            ]}
            options={monthlyOptions}
          />
        </ChartCard.Body>
      </ChartCard>
    ),
    planVsActual: () => (
      <ChartCard>
        <ChartCard.Title><span className={styles.chartTitle}>파트별 계획 vs 추정 실적<InfoButton>{INFO_PLAN_VS_ACTUAL}</InfoButton></span></ChartCard.Title>
        <ChartCard.Body>
          <BarChart
            horizontal
            onClick={openBreakdown('planVsActual')}
            labels={vm.planVsActual.labels}
            datasets={[
              { label: '계획(억)', data: vm.planVsActual.planInitial, backgroundColor: planColor },
              { label: '추정 실적(억)', data: vm.planVsActual.junCheckTotal, backgroundColor: palette.revenue },
            ]}
            options={planVsActualOptions}
          />
        </ChartCard.Body>
      </ChartCard>
    ),
    profitRate: () => {
      // 이상치 표시(시범) — 원가가 매출을 넘는(매출이익 마이너스) 파트의 원가 막대를 손실색으로 강조
      // (작은 카드·확대 모달 둘 다 적용 — 목표선과 달리 이건 항상 보여도 되는 정보라 공통)
      const lossParts = new Set(partRevCostRows.filter(r => r.profit < 0).map(r => r.part));
      // x축 라벨 클릭으로 숨긴 파트는 배열에서 통째로 제외 — 차트에서 그 파트가 사라진다
      const visibleIdx = vm.profitRate.labels
        .map((_, i) => i)
        .filter(i => !hiddenParts.has(vm.profitRate.labels[i]));
      const pick = <T,>(arr: T[]) => visibleIdx.map(i => arr[i]);
      const visibleLabels  = pick(vm.profitRate.labels);
      const visibleCostColors = pick(vm.profitRate.labels.map(p => lossParts.has(p) ? palette.loss : palette.cost));
      const baseDatasets = [
        { label: '매출', data: pick(vm.profitRate.revenues), backgroundColor: palette.revenue },
        { label: '원가', data: pick(vm.profitRate.costs),    backgroundColor: visibleCostColors },
      ];
      // x축 라벨 클릭 — 다른 차트(드릴다운)와 달리 이 차트는 그 파트를 숨김/복원 토글.
      // 막대 자체를 클릭한 경우(datasetIndex >= 0)는 기존처럼 드릴다운 유지.
      const handleAxisToggle = (label: string, datasetIndex: number) => {
        if (datasetIndex >= 0) { openBreakdown('profitRate')(label, datasetIndex); return; }
        setHiddenParts(prev => {
          const next = new Set(prev);
          if (next.has(label)) next.delete(label); else next.add(label);
          return next;
        });
      };
      // 작은 카드 — 목표선 없이 매출/원가만 (좁은 공간에서 라인까지 겹치면 복잡해짐)
      const chartEl = (
        <BarChart
          onClick={handleAxisToggle}
          labels={visibleLabels}
          datasets={baseDatasets}
          options={partRevCostOptions}
        />
      );
      // 확대 모달 전용 — 목표선(매출/원가 계획)을 캔버스 플러그인으로 겹쳐 그려서 계획 대비
      // 실제를 바로 대조 + 표로 전체 파트 검증. line 데이터셋으로 넣으면 그룹 막대(매출/원가)
      // 사이 카테고리 중앙에 점이 찍히는 문제가 있어(makePlanLinePlugin 주석 참고) 대신 실제
      // 막대 엘리먼트 위치에 직접 그리는 방식으로 전환 — 그래서 온오프도 범례 클릭 대신
      // 명시적 토글 버튼으로(더 이상 진짜 Chart.js 데이터셋이 아니라 범례에 안 잡힘)
      // useMemo 없이 매 렌더 재생성 — 작은 배열 리터럴이라 비용 무시 가능하고, 이 함수 자체가
      // chartRenderers 레코드에 담겨 조건적으로 호출되는 위치라 hooks 규칙상 useMemo를 쓰면 안 됨
      const planLinePlugins: Plugin<'bar'>[] = showPlanLine ? [
        makePlanLinePlugin([
          { barIndex: 0, values: pick(vm.profitRate.planRevenue), color: planColor, dash: [6, 4] },
          { barIndex: 1, values: pick(vm.profitRate.planCost), color: fadeAlpha(planColor, 0.7), dash: [3, 3] },
        ]),
      ] : [];
      const modalChartEl = (
        <BarChart
          // exportable   // PNG 내보내기 — 일단 주석 처리(마음에 들지만 보류)
          onClick={handleAxisToggle}
          labels={visibleLabels}
          datasets={baseDatasets}
          options={partRevCostOptions}
          plugins={planLinePlugins}
        />
      );
      const modalContent = (
        <div className={styles.chartModalWithTable}>
          <div className={styles.planLineBar}>
            <span className={styles.planLineLegend}>
              <i className={styles.planLineSwatch} style={{ background: planColor }} />매출 계획
              <i className={styles.planLineSwatch} style={{ background: fadeAlpha(planColor, 0.7) }} />원가 계획
            </span>
            <span className={styles.toggleGroup}>
              <span className={styles.badge}>계획 목표선</span>
              <Toggle checked={showPlanLine} onChange={() => setShowPlanLine(v => !v)} />
            </span>
          </div>
          <div className={styles.chartModalChart}>{modalChartEl}</div>
          <div className={styles.chartModalTable}>
            <DataTable<PartRevCostRow>
              data={partRevCostRows}
              columns={partRevCostColumns as never}
              getRowId={r => r.part}
              compact
              hideToolbar
              defaultPageSize={partRevCostRows.length || 1}
              pageSizeOptions={[partRevCostRows.length || 1]}
            />
          </div>
        </div>
      );
      return (
        <ChartCard modalContent={modalContent} modalHeight="94vh">
          <ChartCard.Title>
            <span className={styles.chartTitle}>파트별 추정 매출/원가<InfoButton>{INFO_PROFIT_RATE}</InfoButton></span>
            {/* 이익율/이익액 토글 비활성화(담당자 지정) — 매출/원가 2계열 고정 표시로 대체. 복구 시 주석 해제
            <span className={styles.toggleGroup}>
              <span className={styles.badge}>{showProfitAmount ? '경상이익' : '평균 이익율'}</span>
              <Toggle checked={showProfitAmount} onChange={() => setShowProfitAmount(v => !v)} danger={showProfitAmount} />
            </span>
            */}
          </ChartCard.Title>
          <ChartCard.Body>{chartEl}</ChartCard.Body>
        </ChartCard>
      );
    },
    costBreakdown: () => (
      <ChartCard
        modalContent={
          <CostBreakdownModal
            total={vm.chartData?.costBreakdownTotal ?? { labels: [], values: [] }}
            byPart={vm.chartData?.costBreakdownByPart ?? {}}
            partsRaw={vm.chartData?.partsRaw ?? []}
            teams={vm.teams}
            teamParts={vm.chartData?.teamParts ?? {}}
            colors={doughnutColors}
            showLabels={vm.showLabels}
            onSliceClick={i => setBreakdown({
              chart: 'costBreakdown', series: i, key: '',
              // 이 카드는 메인 필터 무관 — 카드 자체 팀/파트 선택 기준으로만 조회
              ignoreMainFilter: true,
              partOverride: vm.selectedCostPartRaw,
              teamOverride: vm.selectedCostTeam,
            })}
          />
        }
      >
        <ChartCard.Title>
          <span className={styles.chartTitle}>전체 평균 원가 비율<InfoButton>{INFO_COST_BREAKDOWN}</InfoButton></span>
          <CostFilterPopover
            teams={vm.teams}
            selectedTeam={vm.selectedCostTeam}
            onTeamChange={vm.setSelectedCostTeam}
            parts={(vm.partOptions ?? []).filter(p => p !== '전체')}
            selectedPart={vm.selectedCostPart}
            onPartChange={vm.setSelectedCostPart}
          />
        </ChartCard.Title>
        <ChartCard.Body>
          <DoughnutChart
            labels={vm.costBreakdown.labels}
            data={vm.costBreakdown.values}
            colors={doughnutColors}
            showLabels={vm.showLabels}
            outsideLabels
            onSliceClick={i => setBreakdown({
              chart: 'costBreakdown', series: i, key: '',
              // 이 카드는 메인 필터 무관 — 카드 자체 팀/파트 선택 기준으로만 조회
              ignoreMainFilter: true,
              partOverride: vm.selectedCostPartRaw,
              teamOverride: vm.selectedCostTeam,
            })}
          />
        </ChartCard.Body>
      </ChartCard>
    ),
    // ── 진행단계별 매출/원가 — 비활성(주석 처리). DEFAULT_CHART_ORDER 에 'progress' 추가하면 복구 ──
    // progress: () => vm.progress.labels.length > 0 ? (
    //   <ChartCard>
    //     <ChartCard.Title><span className={styles.chartTitle}>진행단계별 매출/원가<InfoButton>{INFO_PROGRESS}</InfoButton></span></ChartCard.Title>
    //     <ChartCard.Body>
    //       <BarChart
    //         horizontal
    //         labels={vm.progress.labels}
    //         datasets={[
    //           { label: '매출(억)', data: vm.progress.revenues,     backgroundColor: palette.revenue },
    //           { label: '원가(억)', data: vm.progress.expenditures, backgroundColor: palette.cost    },
    //         ]}
    //         options={progressOptions}
    //       />
    //     </ChartCard.Body>
    //   </ChartCard>
    // ) : null,
  };

  const visibleCharts = chartOrder
    .map(id => ({ id, node: chartRenderers[id]?.() ?? null }))
    .filter(c => c.node !== null);

  const chartState = vm.isLoading ? 'loading' : vm.isError ? 'error' : vm.isEmpty ? 'empty' : 'ready';

  const content = chartState === 'loading' ? <ChartStateGrid variant="skeleton" ids={chartOrder} />
    : chartState === 'error' ? <ChartStateGrid variant="error" icon="⚠" message="데이터를 불러올 수 없습니다" ids={chartOrder} />
    : chartState === 'empty' ? <ChartStateGrid variant="empty" icon="📊" message="데이터 없음" ids={chartOrder} />
    : visibleCharts.map(c => (
        <SortableChart
          key={c.id}
          id={c.id}
          fullRow={c.id === FULL_ROW_ID}
          spanClassName={c.id === FULL_ROW_ID ? undefined : styles[SPAN_BY_ID[c.id] ?? 'spanMid']}
        >
          {c.node}
        </SortableChart>
      ));

  return (
    <>
      <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleChartDragEnd}>
        <SortableContext items={visibleCharts.map(c => c.id)} strategy={rectSortingStrategy}>
          <div className={styles.grid} key={`${dark ? 'dark' : 'light'}-${chartState}`}>
            {content}
          </div>
        </SortableContext>
      </DndContext>

      {breakdown && (
        <PerfBreakdownModal target={breakdown} onClose={() => setBreakdown(null)} />
      )}
    </>
  );
};

export default PerformanceChartSection;
