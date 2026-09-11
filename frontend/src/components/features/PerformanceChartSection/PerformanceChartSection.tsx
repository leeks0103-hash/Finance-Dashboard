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
import { ChartCard, BarChart, DoughnutChart, useTableDndSensors, InfoButton, FilterSelect } from '@/components/ui';
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

  // 파트별 경상이익 카드 — 매출/원가 2계열 고정 표시로 변경(담당자 지정) — 토글 비활성화, 복구 시 아래 주석 해제
  // const [showProfitAmount, setShowProfitAmount] = useState(true);

  const { labelColor, gridColor, tickColor } = getChartTheme(dark);

  const vm = usePerformanceChartViewModel();

  // 막대 클릭 → 드릴다운 모달. 축 라벨 클릭(datasetIndex -1)은 첫 시리즈로.
  const [breakdown, setBreakdown] = useState<PerfBreakdownTarget | null>(null);
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
          anchor: 'end',
          align: 'end',
          offset: 2,
          font: { size: 10 },
          formatter: (v: number) => `${v}억`,
        },
      },
    }), scaleOverride),
    scales: {
      x: { ...scaleOverride.x, stacked: false, offset: true, ticks: { ...scaleOverride.x.ticks, align: 'center' } },
      y: { ...scaleOverride.y, ticks: { ...scaleOverride.y.ticks, callback: (v: string | number) => v + '억' } },
    },
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
    profitRate: () => (
      <ChartCard>
        <ChartCard.Title>
          <span className={styles.chartTitle}>파트별 추정 매출/원가<InfoButton>{INFO_PROFIT_RATE}</InfoButton></span>
          {/* 이익율/이익액 토글 비활성화(담당자 지정) — 매출/원가 2계열 고정 표시로 대체. 복구 시 주석 해제
          <span className={styles.toggleGroup}>
            <span className={styles.badge}>{showProfitAmount ? '경상이익' : '평균 이익율'}</span>
            <Toggle checked={showProfitAmount} onChange={() => setShowProfitAmount(v => !v)} danger={showProfitAmount} />
          </span>
          */}
        </ChartCard.Title>
        <ChartCard.Body>
          <BarChart
            onClick={openBreakdown('profitRate')}
            labels={vm.profitRate.labels}
            datasets={[
              { label: '매출', data: vm.profitRate.revenues, backgroundColor: palette.revenue },
              { label: '원가', data: vm.profitRate.costs,    backgroundColor: palette.cost },
            ]}
            options={partRevCostOptions}
          />
        </ChartCard.Body>
      </ChartCard>
    ),
    costBreakdown: () => (
      <ChartCard
        modalContent={
          <CostBreakdownModal
            total={vm.chartData?.costBreakdownTotal ?? { labels: [], values: [] }}
            byPart={vm.chartData?.costBreakdownByPart ?? {}}
            partsRaw={vm.chartData?.partsRaw ?? []}
            colors={doughnutColors}
            showLabels={vm.showLabels}
            onSliceClick={(i, partOverride) => setBreakdown({ chart: 'costBreakdown', series: i, key: '', partOverride })}
          />
        }
      >
        <ChartCard.Title>
          <span className={styles.chartTitle}>전체 평균 원가 비율<InfoButton>{INFO_COST_BREAKDOWN}</InfoButton></span>
          <FilterSelect
            value={vm.selectedCostPart}
            onChange={vm.setSelectedCostPart}
            options={vm.partOptions}
            allLabel={null}   /* partOptions 첫 항목이 이미 '전체' (값도 '전체') */
            ariaLabel="원가 비율 파트 선택"
          />
        </ChartCard.Title>
        <ChartCard.Body>
          <DoughnutChart
            labels={vm.costBreakdown.labels}
            data={vm.costBreakdown.values}
            colors={doughnutColors}
            showLabels={vm.showLabels}
            outsideLabels
            onSliceClick={i => setBreakdown({ chart: 'costBreakdown', series: i, key: '' })}
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
