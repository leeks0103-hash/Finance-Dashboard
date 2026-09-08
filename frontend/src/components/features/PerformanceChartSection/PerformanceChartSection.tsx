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
import { ChartCard, BarChart, DoughnutChart, Toggle, useTableDndSensors, InfoButton } from '@/components/ui';
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

// 파트별 이익율 카드 — 이익율(%)·이익액(억) 두 모드가 완전히 같은 라벨 스타일을 쓰도록 한 곳에서 관리.
// align을 부호에 따라 뒤집어(플러스=막대 위 / 마이너스=막대 아래) 라벨이 막대 위에 얹혀
// 진한 글씨가 진한 막대색에 묻히는 것을 방지 — 항상 카드 배경 위에 그려진다
const PROFIT_LABEL = {
  anchor: 'end' as const,
  align:  (ctx: { dataset: { data: unknown[] }; dataIndex: number }) =>
    (Number(ctx.dataset.data[ctx.dataIndex]) >= 0 ? 'top' : 'bottom'),
  offset: 2,
};

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

  const vm = usePerformanceChartViewModel();

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

  const profitColors = useMemo(() => vm.profitRate.isProfit.map(ok =>
    ok ? palette.rate : palette.loss
  ), [vm.profitRate.isProfit, palette]);

  const doughnutColors = useMemo(
    () => [palette.costDirect, palette.costLabor, palette.costOverhead, palette.costMgmt],
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

  const profitRateOptions = useMemo(() => ({
    ...vm.profitRate.options,
    plugins: {
      ...vm.profitRate.options.plugins,
      legend: { display: false },
      // 이익율/이익액 두 모드가 같은 라벨 스타일·위치를 쓰도록 통일 (색은 makeBarOptions의 labelColor)
      datalabels: { ...vm.profitRate.options.plugins?.datalabels, ...PROFIT_LABEL },
    },
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
      layout: { padding: { top: 24, bottom: 24 } },
      plugins: {
        legend: { display: false },
        datalabels: { ...PROFIT_LABEL, formatter: (v: number) => `${v}억` },
      },
    }),
    scales: { ...scaleOverride, y: { ...scaleOverride.y, ticks: { ...scaleOverride.y.ticks, callback: (v: string | number) => v + '억' } } },
  }), [vm.showLabels, labelColor, scaleOverride]);

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
    profitRate: () => (
      <ChartCard>
        <ChartCard.Title>
          <span className={styles.chartTitle}>파트별 이익율(%)<InfoButton>{INFO_PROFIT_RATE}</InfoButton></span>
          <span className={styles.toggleGroup}>
            <span className={styles.badge}>{showProfitAmount ? '이익액' : '이익율'}</span>
            <Toggle checked={showProfitAmount} onChange={() => setShowProfitAmount(v => !v)} danger={showProfitAmount} />
          </span>
        </ChartCard.Title>
        <ChartCard.Body>
          <BarChart
            labels={vm.profitRate.labels}
            datasets={[showProfitAmount
              // 이익율/이익액 둘 다 마이너스면 빨강 — profitColors 가 부호별 색을 담고 있음
              ? { label: '이익액(억)', data: vm.profitRate.profits, backgroundColor: profitColors }
              : { label: '이익율(%)',  data: vm.profitRate.rates,   backgroundColor: profitColors }
            ]}
            options={showProfitAmount ? profitAmountOptions : profitRateOptions}
          />
        </ChartCard.Body>
      </ChartCard>
    ),
    costBreakdown: () => (
      <ChartCard>
        <ChartCard.Title><span className={styles.chartTitle}>원가 구성<InfoButton>{INFO_COST_BREAKDOWN}</InfoButton></span></ChartCard.Title>
        <ChartCard.Body>
          <DoughnutChart
            labels={vm.costBreakdown.labels}
            data={vm.costBreakdown.values}
            colors={doughnutColors}
            showLabels={vm.showLabels}
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
