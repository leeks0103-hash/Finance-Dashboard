import { useMemo, useState, useCallback, type ReactNode } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useChartViewModel } from '@/hooks/viewmodels';
import { useTheme, useFilterOptions } from '@/hooks';
import { useFilterStore, useUiStore } from '@/store';
import { makeBarOptions } from '@/utils/chartOptions';
import { getChartPalette } from '@/utils/chartColors';
import { isAllSelected } from '@/utils/array';
import { ChartCard, BarChart, DoughnutChart, Toggle } from '@/components/ui';
import styles from './ChartSection.module.css';

const DEFAULT_CHART_ORDER = ['profitRate', 'revExp', 'costBreakdown', 'stageChart'];
const LS_CHART_ORDER = 'finance-chart-order';

// 드래그 가능 차트 카드 래퍼 — 모듈 스코프에서 정의해야 React가 컴포넌트 정체성 유지
// 카드 전체가 아니라 좌상단 그립 아이콘만 드래그 핸들 — 차트 본문(호버·클릭·바 클릭)은 영향 없음
interface SortableChartProps { id: string; children: ReactNode; }
function SortableChart({ id, children }: SortableChartProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
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

const ChartSection = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const togglePart    = useFilterStore(s => s.togglePart);
  const stages        = useFilterStore(s => s.stages);
  const showYearChart = useUiStore(s => s.showYearChart);
  const { stages: allStages } = useFilterOptions();

  const handlePartClick = togglePart;
  const stageLabel = stages.length > 0 && !isAllSelected(stages, allStages) ? stages.join('·') : '전체';

  // 파트별 이익율 카드 — 토글 켜면 이익율(%) 대신 이익액(억원) 표시
  const [showProfitAmount, setShowProfitAmount] = useState(false);

  // 팔레트 — 오렌지/웜 브랜드에 맞춤
  const labelColor = dark ? 'rgba(212,212,216,0.90)' : '#3F3F46';   // zinc-300 / zinc-700
  const gridColor  = dark ? 'rgba(63,63,70,0.60)'    : 'rgba(0,0,0,0.06)';
  const tickColor  = dark ? 'rgba(161,161,170,0.90)' : '#71717A';   // zinc-400 / zinc-500

  const vm = useChartViewModel(labelColor);

  // 차트 카드 드래그 순서 — localStorage 저장 + 새로고침 유지
  const [chartOrder, setChartOrder] = useState<string[]>(() => {
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(LS_CHART_ORDER) ?? '[]');
      const valid = saved.filter(id => DEFAULT_CHART_ORDER.includes(id));
      const added = DEFAULT_CHART_ORDER.filter(id => !valid.includes(id));
      return valid.length ? [...valid, ...added] : DEFAULT_CHART_ORDER;
    } catch { return DEFAULT_CHART_ORDER; }
  });

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleChartDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setChartOrder(prev => {
      const next = arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id)));
      localStorage.setItem(LS_CHART_ORDER, JSON.stringify(next));
      return next;
    });
  }, []);

  // 재무·KPI·실적현황 3탭 공통 팔레트 — 매출=인디고, 지출/원가=레드, 이익=그린, 이익율=퍼플(KpiCard "평균 이익율"와 동일 계열)
  const palette = useMemo(() => getChartPalette(dark), [dark]);

  // 이익율 바: 흑자=퍼플(비율 지표 고유색), 적자=레드
  const profitColors = useMemo(() => vm.profitRate.isProfit.map(ok =>
    ok ? palette.rate : palette.cost
  ), [vm.profitRate.isProfit, palette]);

  // 도넛: 원가구성 세부 — 전부 "원가"이므로 레드 계열 톤 변주로 한 가족임을 드러냄
  const doughnutColors = useMemo(() => [palette.costDirect, palette.costLabor, palette.costOverhead], [palette]);

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

  // 파트별 이익율 카드 토글 ON — 이익액(억원) 뷰용 옵션
  const profitAmountOptions = useMemo(() => ({
    ...makeBarOptions(vm.showLabels, labelColor, {
      layout: { padding: { top: 24 } },
      plugins: {
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
      {[0, 1, 2, 3].map(i => <div key={i} className={styles.skeleton} />)}
    </div>
  );

  if (vm.isError) return (
    <div className={styles.grid}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} className={styles.errorCard}>
          <span className={styles.errorIcon}>⚠</span>
          <span>데이터를 불러올 수 없습니다</span>
        </div>
      ))}
    </div>
  );

  if (vm.isEmpty) return (
    <div className={styles.grid}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} className={styles.emptyCard}>
          <span className={styles.emptyIcon}>📊</span>
          <span>데이터 없음</span>
        </div>
      ))}
    </div>
  );

  // id → 렌더 함수 — 드래그 순서(chartOrder)에 따라 이 중 하나를 골라 렌더
  const chartRenderers: Record<string, () => ReactNode | null> = {
    profitRate: () => (
      <ChartCard>
        <ChartCard.Title>
          <span>파트별 이익율(%)</span>
          <span className={styles.toggleGroup}>
            <span className={styles.stageBadge}>{showProfitAmount ? '이익액' : '이익율'}</span>
            <Toggle checked={showProfitAmount} onChange={() => setShowProfitAmount(v => !v)} />
          </span>
        </ChartCard.Title>
        <ChartCard.Body>
          <BarChart
            labels={vm.profitRate.labels}
            datasets={[showProfitAmount
              ? { label: '이익액(억)', data: vm.revExp.profits,  backgroundColor: palette.cost }
              : { label: '이익율(%)',  data: vm.profitRate.rates, backgroundColor: profitColors }
            ]}
            options={showProfitAmount ? profitAmountOptions : profitRateOptions}
            onClick={handlePartClick}
          />
        </ChartCard.Body>
      </ChartCard>
    ),
    revExp: () => (
      <ChartCard>
        <ChartCard.Title>파트별 매출 / 지출</ChartCard.Title>
        <ChartCard.Body>
          <BarChart
            horizontal
            labels={vm.revExp.labels}
            datasets={[
              { label: '매출(억)', data: vm.revExp.revenues,     backgroundColor: palette.revenue },
              { label: '지출(억)', data: vm.revExp.expenditures, backgroundColor: palette.cost    },
            ]}
            options={revExpOptions}
            onClick={handlePartClick}
          />
        </ChartCard.Body>
      </ChartCard>
    ),
    costBreakdown: () => (
      <ChartCard>
        <ChartCard.Title>
          <span>원가 구성</span>
          <span className={styles.stageBadge}>{stageLabel}</span>
        </ChartCard.Title>
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
    stageChart: () => vm.stageChart.labels.length > 0 ? (
      <ChartCard>
        <ChartCard.Title>보고단계별 매출/지출 현황</ChartCard.Title>
        <ChartCard.Body>
          <BarChart
            horizontal
            labels={vm.stageChart.labels}
            datasets={[
              { label: '매출(억)', data: vm.stageChart.revenues,     backgroundColor: palette.revenue },
              { label: '지출(억)', data: vm.stageChart.expenditures, backgroundColor: palette.cost    },
            ]}
            options={stageChartOptions}
          />
        </ChartCard.Body>
      </ChartCard>
    ) : null,
  };

  const visibleCharts = chartOrder
    .map(id => ({ id, node: chartRenderers[id]?.() ?? null }))
    .filter(c => c.node !== null);

  return (
    /* 테마 전환 시 key로 완전 리마운트 → 색상 보장 */
    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleChartDragEnd}>
      <SortableContext items={visibleCharts.map(c => c.id)} strategy={rectSortingStrategy}>
        <div className={styles.grid} key={dark ? 'dark' : 'light'}>
          {visibleCharts.map(c => (
            <SortableChart key={c.id} id={c.id}>{c.node}</SortableChart>
          ))}

          {showYearChart && vm.yearTrend.labels.length > 0 && (
            <ChartCard>
              <ChartCard.Title>연도별 매출 / 이익 추이</ChartCard.Title>
              <ChartCard.Body>
                <BarChart
                  labels={vm.yearTrend.labels}
                  datasets={[
                    { label: '매출(억)', data: vm.yearTrend.revenues, backgroundColor: palette.revenue },
                    { label: '이익(억)', data: vm.yearTrend.profits,  backgroundColor: palette.profit  },
                  ]}
                  options={yearTrendOptions}
                />
              </ChartCard.Body>
            </ChartCard>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default ChartSection;
