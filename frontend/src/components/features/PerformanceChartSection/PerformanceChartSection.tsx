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
import { ChartCard, BarChart, DoughnutChart, Toggle, useTableDndSensors } from '@/components/ui';
import type { ChartOptions } from 'chart.js';
import styles from './PerformanceChartSection.module.css';

// 레이아웃: 월별 실적 추이(전체 너비 1줄) → 파트별 이익율+원가구성(1줄) → 파트별 계획vs실적+진행단계(1줄)
const DEFAULT_CHART_ORDER = ['monthly', 'profitRate', 'costBreakdown', 'planVsActual', 'progress'];
const LS_CHART_ORDER = 'performance-chart-order';
// 항상 한 줄 전체를 차지하는 차트 — 드래그로 순서가 바뀌어도 이 카드가 위치한 줄은 전체 폭 유지
const FULL_ROW_ID = 'monthly';

// 팔레트의 rgba(...) 문자열 알파값만 교체 — 미래 월/보조 계열 흐림 처리용
const fadeAlpha = (rgba: string, alpha: number) => rgba.replace(/[\d.]+\)$/, `${alpha})`);

// x축 stacked 해제 + 테마(격자·눈금) 색 오버라이드 병합 — 그룹형 바 차트 여러 개가 공유하는 패턴
const withUnstackedTheme = (
  options: ChartOptions<'bar'>,
  scaleOverride: { x: Record<string, unknown>; y: Record<string, unknown> },
): ChartOptions<'bar'> => ({
  ...options,
  scales: { ...scaleOverride, x: { ...scaleOverride.x, stacked: false } },
});

// 드래그 가능 차트 카드 래퍼 — 재무 ChartSection과 동일 패턴(카드 전체가 아닌 그립 아이콘만 드래그)
interface SortableChartProps { id: string; fullRow?: boolean; children: ReactNode; }
function SortableChart({ id, fullRow, children }: SortableChartProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className={fullRow ? styles.fullRow : undefined}
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

// 로딩/에러/데이터없음 플레이스홀더 — 카드 개수만큼 반복, 첫 칸은 monthly 자리라 전체 폭
interface ChartStateGridProps { variant: 'skeleton' | 'error' | 'empty'; icon?: string; message?: string; count: number; }
function ChartStateGrid({ variant, icon, message, count }: ChartStateGridProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => i).map(i => variant === 'skeleton' ? (
        <div key={i} className={`${styles.skeleton} ${i === 0 ? styles.fullRow : ''}`} />
      ) : (
        <div key={i} className={`${variant === 'error' ? styles.errorCard : styles.emptyCard} ${i === 0 ? styles.fullRow : ''}`}>
          <span className={variant === 'error' ? styles.errorIcon : styles.emptyIcon}>{icon}</span>
          <span>{message}</span>
        </div>
      ))}
    </>
  );
}

const PerformanceChartSection = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  // 파트별 이익율 카드 — 토글 켜면 이익율(%) 대신 이익액(억원) 표시
  const [showProfitAmount, setShowProfitAmount] = useState(false);

  const { labelColor, gridColor, tickColor } = getChartTheme(dark);

  const vm = usePerformanceChartViewModel(labelColor);

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

  // "계획" 막대 — palette엔 없는 중립색(실적/원가 계열과 겹치지 않게)
  const planColor = useMemo(
    () => dark ? 'rgba(148,163,184,0.55)' : 'rgba(100,116,139,0.45)',
    [dark],
  );

  const profitColors = useMemo(() => vm.profitRate.isProfit.map(ok =>
    ok ? palette.rate : palette.cost
  ), [vm.profitRate.isProfit, palette]);

  const doughnutColors = useMemo(() => [palette.costDirect, palette.costLabor, palette.costOverhead], [palette]);

  const scaleOverride = useMemo(() => ({
    x: { grid: { color: gridColor }, ticks: { color: tickColor } },
    y: { grid: { color: gridColor }, ticks: { color: tickColor } },
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

  const profitRateOptions = useMemo(() => ({
    ...vm.profitRate.options,
    plugins: { ...vm.profitRate.options.plugins, legend: { display: false } },
    scales: {
      ...vm.profitRate.options.scales,
      y: {
        ...scaleOverride.y,
        type: 'linear' as const,
        ticks: { ...scaleOverride.y.ticks, callback: (v: string | number) => v + '%' },
      },
    },
  }), [vm.profitRate.options, scaleOverride]);

  const profitAmountOptions = useMemo(() => ({
    ...makeBarOptions(vm.showLabels, labelColor, {
      layout: { padding: { top: 24 } },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align:  'top',
          offset: 2,
          formatter: (v: number) => `${v}억`,
        },
      },
    }),
    scales: { ...scaleOverride, y: { ...scaleOverride.y, ticks: { ...scaleOverride.y.ticks, callback: (v: string | number) => v + '억' } } },
  }), [vm.showLabels, labelColor, scaleOverride]);

  const progressOptions = useMemo(
    () => withUnstackedTheme(vm.progress.options, scaleOverride),
    [vm.progress.options, scaleOverride],
  );

  const chartRenderers: Record<string, () => ReactNode | null> = {
    monthly: () => (
      <ChartCard>
        <ChartCard.Title>월별 실적 추이</ChartCard.Title>
        <ChartCard.Body>
          <BarChart
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
        <ChartCard.Title>파트별 계획 vs 실적</ChartCard.Title>
        <ChartCard.Body>
          <BarChart
            horizontal
            labels={vm.planVsActual.labels}
            datasets={[
              { label: '계획(억)', data: vm.planVsActual.planInitial, backgroundColor: planColor },
              { label: '실적(억)', data: vm.planVsActual.junActual,   backgroundColor: palette.revenue },
            ]}
            options={planVsActualOptions}
          />
        </ChartCard.Body>
      </ChartCard>
    ),
    profitRate: () => (
      <ChartCard>
        <ChartCard.Title>
          <span>파트별 이익율(%)</span>
          <span className={styles.toggleGroup}>
            <span className={styles.badge}>{showProfitAmount ? '이익액' : '이익율'}</span>
            <Toggle checked={showProfitAmount} onChange={() => setShowProfitAmount(v => !v)} danger={showProfitAmount} />
          </span>
        </ChartCard.Title>
        <ChartCard.Body>
          <BarChart
            labels={vm.profitRate.labels}
            datasets={[showProfitAmount
              ? { label: '이익액(억)', data: vm.profitRate.profits, backgroundColor: palette.cost }
              : { label: '이익율(%)',  data: vm.profitRate.rates,   backgroundColor: profitColors }
            ]}
            options={showProfitAmount ? profitAmountOptions : profitRateOptions}
          />
        </ChartCard.Body>
      </ChartCard>
    ),
    costBreakdown: () => (
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
    ),
    progress: () => vm.progress.labels.length > 0 ? (
      <ChartCard>
        <ChartCard.Title>진행단계별 매출/원가</ChartCard.Title>
        <ChartCard.Body>
          <BarChart
            horizontal
            labels={vm.progress.labels}
            datasets={[
              { label: '매출(억)', data: vm.progress.revenues,     backgroundColor: palette.revenue },
              { label: '원가(억)', data: vm.progress.expenditures, backgroundColor: palette.cost    },
            ]}
            options={progressOptions}
          />
        </ChartCard.Body>
      </ChartCard>
    ) : null,
  };

  const visibleCharts = chartOrder
    .map(id => ({ id, node: chartRenderers[id]?.() ?? null }))
    .filter(c => c.node !== null);

  const chartState = vm.isLoading ? 'loading' : vm.isError ? 'error' : vm.isEmpty ? 'empty' : 'ready';

  const content = chartState === 'loading' ? <ChartStateGrid variant="skeleton" count={5} />
    : chartState === 'error' ? <ChartStateGrid variant="error" icon="⚠" message="데이터를 불러올 수 없습니다" count={5} />
    : chartState === 'empty' ? <ChartStateGrid variant="empty" icon="📊" message="데이터 없음" count={5} />
    : visibleCharts.map(c => <SortableChart key={c.id} id={c.id} fullRow={c.id === FULL_ROW_ID}>{c.node}</SortableChart>);

  return (
    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleChartDragEnd}>
      <SortableContext items={visibleCharts.map(c => c.id)} strategy={rectSortingStrategy}>
        <div className={styles.grid} key={`${dark ? 'dark' : 'light'}-${chartState}`}>
          {content}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default PerformanceChartSection;
