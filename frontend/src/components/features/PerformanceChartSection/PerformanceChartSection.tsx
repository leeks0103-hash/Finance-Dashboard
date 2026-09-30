import { useMemo, useState, useCallback, type ReactNode } from 'react';
import {
  DndContext, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { usePerformanceChartViewModel } from '@/hooks/viewmodels';
import type { MonthlyTableRow, PlanVsActualRow } from '@/hooks/viewmodels/usePerformanceChartViewModel';
import { useTheme } from '@/hooks';
import { makeBarOptions, legendRadioClick } from '@/utils/chartOptions';
import { getChartPalette, getChartTheme } from '@/utils/chartColors';
// Toggle — 파트별 경상이익 토글 비활성화로 미사용(주석 처리). 복구 시 함께 import
import { createColumnHelper } from '@tanstack/react-table';
import { ChartCard, BarChart, DoughnutChart, DataTable, useTableDndSensors, InfoButton, Button, LineIcon } from '@/components/ui';
import type { Plugin, Chart, LegendItem, LegendElement, ChartEvent } from 'chart.js';
import CostFilterPopover from './CostFilterPopover';
import PerfBreakdownModal from '@/components/features/PerfBreakdownModal/PerfBreakdownModal';
import CostBreakdownModal from './CostBreakdownModal';
import { canPerfBreakdown, type PerfBreakdownTarget } from '@/hooks/viewmodels/usePerfBreakdownViewModel';
import type { PerfBreakdownChart } from '@/api/performance.api';
import {
  INFO_MONTHLY, INFO_PROFIT_RATE, INFO_COST_BREAKDOWN,
  INFO_PLAN_VS_ACTUAL,
} from '@/utils/infoTexts';
import type { ChartOptions } from 'chart.js';
import { stripPartPrefix } from '@/utils/format';
import { getDatalabelAlpha } from '@/utils/datalabelFade';
import { SORTABLE_TRANSITION, sortableItemStyle } from '@/components/ui/sortableMotion';
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

// "월별 실적 추이" 확대 모달의 검증용 표 — 그냥 확대만 되는 모달이라는 피드백에 따라
// 월별 수치 + 누계(연 진행 추적용)를 표로 함께 노출. 행 계산은 VM(MonthlyTableRow — 원금액 기준).
// 수치 셀 클릭 → 차트 막대처럼 산출 근거 모달(2026-09-28). 컬럼 순서 = 백엔드 _PERF_BREAKDOWN
// ["monthly"] series 인덱스(0 매출 / 1 원가 / 2 손익 / 3 누계매출 / 4 누계손익)
const mr = createColumnHelper<MonthlyTableRow>();
const MONTHLY_VALUE_COLS: { key: Exclude<keyof MonthlyTableRow, 'month'>; header: string; size: number }[] = [
  { key: 'revenue',    header: '매출(억)',     size: 90 },
  { key: 'cost',       header: '원가(억)',     size: 90 },
  { key: 'profit',     header: '손익(억)',     size: 90 },
  { key: 'cumRevenue', header: '누계매출(억)', size: 100 },
  { key: 'cumProfit',  header: '누계손익(억)', size: 100 },
];
const buildMonthlyColumns = (onCellClick: (month: string, series: number) => void) => [
  mr.accessor('month', { header: '월', size: 60 }),
  ...MONTHLY_VALUE_COLS.map(({ key, header, size }, series) =>
    mr.accessor(key, {
      header, size,
      cell: i => (
        <Button
          unstyled
          className={styles.cellLink}
          title="클릭하면 이 값의 산출 근거(프로젝트별 합계)를 봅니다"
          onClick={() => onCellClick(i.row.original.month, series)}
        >
          {i.getValue().toLocaleString()}
        </Button>
      ),
    })),
];

// "파트별 계획 vs 추정 실적" 확대 모달 표 — 크게만 보이던 모달이 빈약하다는 피드백(2026-09-29)으로
// 파트별 계획·추정 실적·차이를 표로. 계획/추정 셀 클릭 → 막대 클릭과 같은 산출 근거 모달
// (series 0 계획 / 1 추정 실적 = 백엔드 _PERF_BREAKDOWN["planVsActual"]).
// 달성률은 관리자 토글일 때만 컬럼 추가 — 저조 파트가 한눈에 드러나지 않게(no-stigmatizing 원칙)
const pva = createColumnHelper<PlanVsActualRow>();
const fmtEok = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtDiff = (v: number) => (v > 0 ? '+' : '') + fmtEok(v);
const buildPlanVsActualColumns = (
  showRate: boolean,
  onCellClick: (part: string, series: number) => void,
  hidden: ReadonlySet<string>,
  onToggle: (part: string) => void,
) => {
  // 체크 해제한 파트 행은 셀 내용만 흐리게(DataTable에 행 클래스 prop이 없어 셀에서 처리)
  const dim = (part: string, node: ReactNode) =>
    hidden.has(part) ? <span className={styles.hiddenPartCell}>{node}</span> : node;
  const linkCell = (series: number) => (i: { getValue: () => number; row: { original: PlanVsActualRow } }) => dim(
    i.row.original.part,
    <Button
      unstyled
      className={styles.cellLink}
      title="클릭하면 이 값의 산출 근거(프로젝트별 합계)를 봅니다"
      onClick={() => onCellClick(i.row.original.part, series)}
    >
      {fmtEok(i.getValue())}
    </Button>,
  );
  return [
    // 체크 해제 → 모달 차트에서 그 파트 제외 + 합계에서 빠짐(행은 흐리게 남겨 다시 켤 수 있게)
    pva.display({
      id: 'show', header: '표시', size: 40,
      cell: i => (
        <input
          type="checkbox"
          className={styles.partCheckbox}
          aria-label={`${i.row.original.part} 표시`}
          checked={!hidden.has(i.row.original.part)}
          onChange={() => onToggle(i.row.original.part)}
        />
      ),
    }),
    pva.accessor('part',   { header: '파트',            size: 90, cell: i => dim(i.getValue(), i.getValue()) }),
    pva.accessor('plan',   { header: '계획(억)',        size: 72, cell: linkCell(0) }),
    pva.accessor('actual', { header: '추정 실적(억)',   size: 88, cell: linkCell(1) }),
    pva.accessor('diff',   { header: '차이(억)',        size: 72, cell: i => dim(i.row.original.part, fmtDiff(i.getValue())) }),
    ...(showRate
      ? [pva.accessor('rate', { header: '달성률(%)', size: 80,
          cell: i => dim(i.row.original.part, i.getValue() == null ? '—' : `${i.getValue()}%`) })]
      : []),
  ];
};

// 팔레트의 rgba(...) 문자열 알파값만 교체 — 미래 월/보조 계열 흐림 처리용
const fadeAlpha = (rgba: string, alpha: number) => rgba.replace(/[\d.]+\)$/, `${alpha})`);

// "파트별 추정 매출/원가" 확대 모달의 계획 목표선 — line 타입 데이터셋으로 넣으면 Chart.js가
// 그룹형 막대(매출/원가 2개)의 카테고리 중앙에 점을 찍어서 두 막대 "사이"에 점이 찍히는
// 문제가 있었음(그룹 막대는 중앙 기준 좌우로 나뉘어 그려지는데, line 데이터셋은 그 나눔에
// 참여하지 않고 항상 카테고리 중앙 픽셀을 씀). 대신 캔버스 플러그인으로 실제 렌더링된 막대
// 엘리먼트의 x 픽셀(el.x)을 직접 읽어 그 위에 정확히 겹쳐 그린다 — 특정 막대(barIndex)와
// 항상 픽셀 단위로 정렬됨.
//
// ⚠️ 플러그인 인스턴스는 반드시 모듈 스코프에 "한 번만" 만들어서 재사용할 것 — react-chartjs-2는
// <Bar plugins={...}> prop을 차트 최초 생성(new Chart(...)) 시점에만 읽고, 이후 리렌더로 배열이
// 바뀌어도 다시 반영하지 않는다(node_modules/react-chartjs-2 ChartComponent 소스 확인 — plugins는
// useEffect 의존성에 없음). 그래서 예전처럼 매 렌더 클로저로 새 plugin을 만들어 넘기면, 토글을
// 눌러도 최초 마운트 시점 값으로 고정된 옛 plugin 인스턴스만 계속 그려서 "꺼도 안 지워지는" 버그가
// 났음. 대신 이 plugin은 리렌더와 무관한 고정 인스턴스로 두고, 그릴 때마다 chart.options에서
// 최신 series를 읽는다 — options는 매 렌더 새로 내려가고 react-chartjs-2가 그건 제대로
// chart.update()로 반영하므로, 여기서 매번 최신값을 볼 수 있다.
interface PlanLineSeries { barIndex: number; values: (number | null)[]; color: string; dash: number[]; }
interface PlanLinePluginOpts { series: PlanLineSeries[]; showLabels?: boolean; labelColor?: string; surfaceColor?: string; }

// 목표선 애니메이션 — 캔버스 직접 그리기라 Chart.js 애니메이션을 못 타서 막대만 자라 오르고 선은
// 최종 위치에 뚝 찍혀 있었음(2026-09-28). 직접 트윈:
//   · 처음 그리거나 다시 켰을 때(reveal) — 일반 꺾은선처럼 왼쪽 → 오른쪽으로 그려 나감(clip 영역 확장)
//   · 값이 바뀌면(필터 등) — 이전 위치 → 새 위치로 값 공간에서 이동
// easeInOutQuart는 막대(makeBarOptions)와 동일. 상태는 차트 인스턴스별(WeakMap — 차트 destroy 시
// 자동 해제), 시리즈는 barIndex로 구분
const PLAN_ANIM_MS = 900;
const easeInOutQuart = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);
interface PlanTween { from: (number | null)[]; to: (number | null)[]; start: number; reveal: boolean; }
const planTweens = new WeakMap<object, Map<number, PlanTween>>();
const planRafPending = new WeakSet<object>();
const tweenValueAt = (tw: PlanTween, i: number, e: number) => {
  const to = tw.to[i];
  if (to == null) return null;
  const from = tw.from[i] ?? 0;
  return from + (to - from) * e;
};

// 텍스트 ↔ 그래프 겹침 방지(2026-09-28). 그리는 순서를 셋으로 나눔:
//   1) 목표선·점 — 막대를 다 그린 직후(afterDatasetDraw, 마지막으로 그려지는 데이터셋 뒤).
//      datalabels(전역 플러그인)는 afterDatasetsDraw에서 그리므로 막대 수치가 선 "위"에 올라옴.
//      예전엔 선을 afterDatasetsDraw에서 그려서(인라인 플러그인은 전역 뒤에 실행) 선이 막대
//      수치를 관통했음
//   2) 막대 수치 — datalabels. 모달에선 글자 테두리(카드 배경색 halo)로 선이 글자 뒤로 지나감.
//      ⚠️ 배경 '박스'는 쓰지 말 것 — 수치 박스가 막대보다 넓어서 옆의 더 높은 막대 모서리를
//      배경색으로 덮어 막대가 파먹힌 것처럼 보였음(2026-09-28)
//   3) 목표선 수치 — 맨 마지막(이 플러그인의 afterDatasetsDraw). 점 위 → 점 아래 순으로 후보를
//      놓아보고 막대·막대 수치·다른 목표선 수치와 안 겹치는 자리에 찍음. 둘 다 막히면 생략
//      (점선+점은 남아 있고, 정확한 값은 모달 아래 표에 있음)
interface PlanPt { x: number; y: number; v: number | null }
interface PlanDrawn { pts: (PlanPt | null)[]; color: string; clipX: number }
interface Rect { l: number; r: number; t: number; b: number }
const planDrawn = new WeakMap<object, PlanDrawn[]>();
const PLAN_FONT = "bold 12px 'HyundaiSans', 'Malgun Gothic', sans-serif";
const LABEL_H = 16;       // 12px 글자 + 위아래 여백 — 막대 수치(datalabels padding)와 같은 높이
const LABEL_PAD_X = 3;
// 파트별 추정 매출/원가(메인 카드) — 원가 수치만 오른쪽으로 미는 양(px, 소수 가능). 막대는 그대로.
// datalabels엔 가로 오프셋 옵션이 없고 padding은 배경 박스만 키울 뿐 글자는 항상 기준점 가운데라
// (boundingRects: text.x = -w/2 고정) 안 움직임 — 대신 align을 '막대 위(-90°)'에서 아주 조금 기울여
// 가로 이동량이 정확히 COST_LABEL_SHIFT가 되게 각도를 계산(가로 이동 ≈ (박스폭/2 + offset)·tanθ)
const COST_LABEL_SHIFT = 1.1;
const REV_COST_LABEL_FONT = "bold 12px 'HyundaiSans', 'Malgun Gothic', sans-serif";
const REV_COST_LABEL_OFFSET = 2;
const costLabelAlign = (ctx: { chart: Chart; datasetIndex: number; dataIndex: number; dataset: { data: unknown[] } }) => {
  if (ctx.datasetIndex !== 1 || !COST_LABEL_SHIFT) return 'end' as const;
  const c = ctx.chart.ctx;
  c.save();
  c.font = REV_COST_LABEL_FONT;
  const w = c.measureText(`${ctx.dataset.data[ctx.dataIndex]}억`).width + LABEL_PAD_X * 2;
  c.restore();
  return -90 + (Math.atan(COST_LABEL_SHIFT / (w / 2 + REV_COST_LABEL_OFFSET)) * 180) / Math.PI;
};
const overlaps = (a: Rect, b: Rect) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

const drawPlanLines = (chart: Chart<'bar'>) => {
  const drawn: PlanDrawn[] = [];
  planDrawn.set(chart, drawn);
  const opts = (chart.options.plugins as { planLine?: PlanLinePluginOpts } | undefined)?.planLine;
  const series = opts?.series ?? [];
  const tweens = planTweens.get(chart) ?? new Map<number, PlanTween>();
  planTweens.set(chart, tweens);
  // 꺼진 시리즈는 상태를 버려서, 다시 켜면 0부터 다시 올라오게
  [...tweens.keys()].forEach(k => { if (!series.some(s => s.barIndex === k)) tweens.delete(k); });
  if (!series.length) return;
  const now = performance.now();
  let animating = false;
  const { ctx } = chart;
  series.forEach(({ barIndex, values: targets, color, dash }) => {
    const meta = chart.getDatasetMeta(barIndex);
    const yScale = chart.scales[meta?.yAxisID ?? 'y'];
    if (!meta?.data?.length || !yScale) return;

    let tw = tweens.get(barIndex);
    const changed = !tw || tw.to.length !== targets.length || tw.to.some((v, i) => v !== targets[i]);
    if (changed) {
      const prev = tw;
      const prevE = prev && !prev.reveal ? easeInOutQuart(Math.min(1, (now - prev.start) / PLAN_ANIM_MS)) : 1;
      tw = {
        // reveal 도중에 값이 바뀌면 그리던 선은 이미 최종값 위치라 거기서 이동 시작
        from:   prev ? targets.map((_, i) => tweenValueAt(prev, i, prevE)) : [...targets],
        to:     [...targets],
        start:  now,
        reveal: !prev || (prev.reveal && now - prev.start < PLAN_ANIM_MS),
      };
      tweens.set(barIndex, tw);
    }
    const t = Math.min(1, (now - tw!.start) / PLAN_ANIM_MS);
    if (t < 1) animating = true;
    const e = easeInOutQuart(t);
    const values = tw!.reveal ? targets : targets.map((_, i) => tweenValueAt(tw!, i, e));
    // reveal이면 차트 왼쪽 끝부터 진행률만큼만 보이게
    const { left, right, top, bottom } = chart.chartArea;
    const clipX = tw!.reveal && t < 1 ? left + (right - left) * e : Infinity;
    // 수치 라벨은 datalabels가 못 봄(실제 데이터셋이 아니라 캔버스 직접 그리기) — 3단계에서 직접 그림.
    // 라벨 수치는 트윈 중간값이 아니라 최종 목표값(targets) — 위치만 움직이고 숫자는 고정
    const pts = meta.data.map((el, i) => {
      const v = values[i];
      if (v == null) return null;
      return { x: (el as unknown as { x: number }).x, y: yScale.getPixelForValue(v), v: targets[i] };
    });
    drawn.push({ pts, color, clipX });
    ctx.save();
    if (clipX !== Infinity) {
      ctx.beginPath();
      ctx.rect(left, top - 30, clipX - left, bottom - top + 30);   // 위 30px = 수치 라벨 자리
      ctx.clip();
    }
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
  // 트윈 중이면 다음 프레임 다시 그리기 — 막대 애니메이션과 겹쳐도 프레임당 1회만 예약.
  // chart.draw()는 update 없이 현재 상태만 다시 그려서 막대 애니메이션을 방해하지 않음
  if (animating && !planRafPending.has(chart)) {
    planRafPending.add(chart);
    requestAnimationFrame(() => {
      planRafPending.delete(chart);
      if (chart.ctx) chart.draw();   // destroy된 차트(ctx=null)면 중단
    });
  }
};

// 피해야 할 영역 — 보이는 막대 몸통 + 그 위 막대 수치 박스(partRevCostOptions datalabels와 같은 규칙:
// anchor/align 'end', offset 2, 높이 LABEL_H). ctx.font가 PLAN_FONT로 설정된 상태에서 호출할 것
const collectObstacles = (chart: Chart<'bar'>, showBarLabels: boolean): Rect[] => {
  const { ctx } = chart;
  const rects: Rect[] = [];
  chart.getSortedVisibleDatasetMetas().forEach(meta => {
    const data = chart.data.datasets[meta.index]?.data ?? [];
    meta.data.forEach((el, i) => {
      const bar = el as unknown as { x: number; y: number; base: number; width: number };
      const raw = data[i];
      if (typeof raw !== 'number' || !Number.isFinite(bar.y)) return;
      const half = bar.width / 2;
      rects.push({ l: bar.x - half, r: bar.x + half, t: Math.min(bar.y, bar.base), b: Math.max(bar.y, bar.base) });
      if (!showBarLabels) return;
      const w = ctx.measureText(`${raw}억`).width + LABEL_PAD_X * 2;
      const up = bar.y <= bar.base;   // 양수 막대 → 수치는 막대 위, 음수 → 아래
      const t = up ? bar.y - 2 - LABEL_H : bar.y + 2;
      rects.push({ l: bar.x - w / 2, r: bar.x + w / 2, t, b: t + LABEL_H });
    });
  });
  return rects;
};

const drawPlanLabels = (chart: Chart<'bar'>) => {
  const opts = (chart.options.plugins as { planLine?: PlanLinePluginOpts } | undefined)?.planLine;
  const drawn = planDrawn.get(chart) ?? [];
  if (!opts?.showLabels || !drawn.length) return;
  const { ctx } = chart;
  ctx.save();
  ctx.globalAlpha = getDatalabelAlpha();   // "그래프 수치" 토글 페이드를 datalabels와 같이 탐
  ctx.font = PLAN_FONT;
  const obstacles = collectObstacles(chart, true);
  const { top } = chart.chartArea;
  drawn.forEach(({ pts, color, clipX }) => {
    pts.forEach(p => {
      if (!p || p.v == null || p.x > clipX) return;
      const text = `${p.v}억`;
      const w = ctx.measureText(text).width + LABEL_PAD_X * 2;
      const l = p.x - w / 2;
      // 후보: 점 위 → 점 아래. 점(반지름 3.5)과도 안 겹치게 5px 띄움
      const candidates: Rect[] = [
        { l, r: l + w, t: p.y - 5 - LABEL_H, b: p.y - 5 },
        { l, r: l + w, t: p.y + 5,           b: p.y + 5 + LABEL_H },
      ];
      const spot = candidates.find(c => c.t >= top - 30 && !obstacles.some(o => overlaps(c, o)));
      if (!spot) return;
      obstacles.push(spot);   // 다음 목표선 수치가 이 자리를 피하도록
      if (opts.surfaceColor) {
        ctx.fillStyle = opts.surfaceColor;
        ctx.beginPath();
        ctx.roundRect(spot.l, spot.t, w, LABEL_H, 3);
        ctx.fill();
      }
      ctx.fillStyle = opts.labelColor ?? color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, p.x, spot.t + LABEL_H / 2 + 0.5);
    });
  });
  ctx.restore();
};

const planLinePlugin: Plugin<'bar'> = {
  id: 'planLine',
  beforeDraw(chart) { planDrawn.delete(chart); },
  // 막대는 getSortedVisibleDatasetMetas() 역순으로 그려짐 → [0]이 마지막 = 막대 다 그린 직후
  afterDatasetDraw(chart, args) {
    const first = chart.getSortedVisibleDatasetMetas()[0];
    if (first && args.index === first.index) drawPlanLines(chart);
  },
  afterDatasetsDraw(chart) {
    if (!planDrawn.has(chart)) drawPlanLines(chart);   // 막대가 전부 숨김이면 위 훅이 안 불림
    drawPlanLabels(chart);
  },
};

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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, transition: SORTABLE_TRANSITION });
  return (
    <div
      ref={setNodeRef}
      className={[fullRow ? styles.fullRow : '', spanClassName ?? ''].filter(Boolean).join(' ') || undefined}
      style={{
        ...sortableItemStyle({ transform, transition, isDragging }),
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
interface ChartStateGridProps { variant: 'skeleton' | 'error' | 'empty'; icon?: ReactNode; message?: string; ids: string[]; }
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

  const { labelColor, gridColor, tickColor, surfaceColor } = getChartTheme(dark);

  const vm = usePerformanceChartViewModel();

  // 막대 클릭 → 드릴다운 모달. 축 라벨 클릭(datasetIndex -1)은 첫 시리즈로.
  const [breakdown, setBreakdown] = useState<PerfBreakdownTarget | null>(null);
  // 드릴다운 모달 열기 — 백엔드가 산출 근거를 모르는 차트/시리즈(계획선 등)면 빈 "알 수 없는
  // 차트/시리즈" 모달 대신 아무 일도 안 일어나게(2026-09-28)
  const openTarget = useCallback((t: PerfBreakdownTarget) => {
    if (canPerfBreakdown(t.chart, t.series)) setBreakdown(t);
  }, []);
  // "파트별 추정 매출/원가"의 x축 라벨 클릭 — 다른 차트처럼 드릴다운을 여는 대신, 그 파트를
  // 차트에서 숨김/복원 토글(다시 클릭하면 되돌아옴). 데이터가 많아 복잡할 때 걸러보기 위함
  const [hiddenParts, setHiddenParts] = useState<Set<string>>(new Set());
  const togglePart = useCallback((label: string) => {
    setHiddenParts(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }, []);
  // "파트별 추정 매출/원가" 확대 모달 전용 — 계획 목표선(매출/원가 계획) 오버레이 온오프.
  // 두 선을 하나로 묶지 않고 개별로 껐다 켤 수 있게 분리(매출 계획만 보고 싶을 때 등)
  const [showPlanRevenue, setShowPlanRevenue] = useState(true);
  const [showPlanCost, setShowPlanCost] = useState(true);
  const openBreakdown = useCallback(
    (chart: PerfBreakdownChart) => (key: string, dsIndex: number) =>
      openTarget({ chart, series: dsIndex < 0 ? 0 : dsIndex, key }),
    [openTarget],
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

  // 수치 글자색 = 그 막대 색(계획 회색 / 추정 실적 남색) — 공통 labelColor(남색)였을 땐 두 수치가
  // 같은 색이라 어느 막대 값인지 헷갈림(2026-09-29). 단 계획은 막대색(반투명 plan)이 글자로는 흐려서
  // 불투명·진한 palette.planLabel — 막대색은 계획 통일색 그대로
  const planVsActualOptions = useMemo(() => {
    const base = withUnstackedTheme(vm.planVsActual.options, scaleOverride);
    return {
      ...base,
      plugins: {
        ...base.plugins,
        datalabels: {
          ...base.plugins?.datalabels,
          color: (ctx: { datasetIndex: number; dataset: { backgroundColor?: unknown }; dataIndex: number }) => {
            if (ctx.datasetIndex === 0) return palette.planLabel;
            const bg = ctx.dataset.backgroundColor;
            return (Array.isArray(bg) ? bg[ctx.dataIndex] : bg) as string;
          },
        },
      },
    };
  }, [vm.planVsActual.options, scaleOverride, palette.planLabel]);

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
          // 원가 수치만 오른쪽으로 COST_LABEL_SHIFT px(위 costLabelAlign) — 메인 카드만, 확대 모달은 'end'로 되돌림
          align: costLabelAlign,
          offset: REV_COST_LABEL_OFFSET,
          font: { size: 12, weight: 'bold', family: "'HyundaiSans', 'Malgun Gothic', sans-serif" },
          formatter: (v: number) => `${v}억`,
          // padding은 planLinePlugin의 LABEL_H/LABEL_PAD_X(목표선 수치 겹침 판정용 크기)와 맞춰둘 것.
          // 배경 박스(backgroundColor)는 넣지 말 것 — 옆 막대를 파먹음(planLinePlugin 주석 참고)
          padding: { top: 1, bottom: 1, left: LABEL_PAD_X, right: LABEL_PAD_X },
          // 수치 글자색 = 그 막대 색(매출 파랑 / 원가 갈색, 손실 파트 원가는 빨강) — 막대 위(anchor/align
          // 'end')에 찍혀서 막대와 안 겹침. 공통 labelColor(단색)였을 땐 매출·원가·계획선 수치가 한데
          // 섞여 어느 계열 값인지 헷갈렸음(2026-09-28)
          color: (ctx: { dataset: { backgroundColor?: unknown }; dataIndex: number }) => {
            const bg = ctx.dataset.backgroundColor;
            return (Array.isArray(bg) ? bg[ctx.dataIndex] : bg) as string;
          },
        },
      },
    }), scaleOverride),
    scales: {
      // x축 파트명 — 다크 모드에선 흰색(공통 tickColor Sand가 어두운 배경에서 흐려 보임), 라이트는 공통값 유지
      x: { ...scaleOverride.x, stacked: false, offset: true, ticks: { ...scaleOverride.x.ticks, align: 'center' as const, color: dark ? '#FFFFFF' : tickColor } },
      y: { ...scaleOverride.y, ticks: { ...scaleOverride.y.ticks, callback: (v: string | number) => v + '억' } },
    },
  }), [vm.showLabels, labelColor, scaleOverride, dark, tickColor]);

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

  // "월별 실적 추이" 확대 모달 표 — 행은 VM(원금액 기준 계산), 셀 클릭은 차트 막대와 같은 드릴다운
  // 확대 모달 표 체크박스로 숨긴 파트 — 이 차트 전용(파트별 추정 매출/원가의 hiddenParts와 별개)
  const [pvaHidden, setPvaHidden] = useState<Set<string>>(new Set());
  const togglePvaPart = useCallback((part: string) => {
    setPvaHidden(prev => {
      const next = new Set(prev);
      if (next.has(part)) next.delete(part); else next.add(part);
      return next;
    });
  }, []);
  const planVsActualColumns = useMemo(
    () => buildPlanVsActualColumns(
      vm.planVsActual.showRate,
      (part, series) => openBreakdown('planVsActual')(part, series),
      pvaHidden,
      togglePvaPart,
    ),
    [vm.planVsActual.showRate, openBreakdown, pvaHidden, togglePvaPart],
  );

  const monthlyRows = vm.monthly.rows;
  const monthlyRowColumns = useMemo(
    () => buildMonthlyColumns((month, series) => openBreakdown('monthly')(month, series)),
    [openBreakdown],
  );

  // progress 차트 비활성으로 미사용 — 복구 시 함께 주석 해제
  // const progressOptions = useMemo(
  //   () => withUnstackedTheme(vm.progress.options, scaleOverride),
  //   [vm.progress.options, scaleOverride],
  // );

  const chartRenderers: Record<string, () => ReactNode | null> = {
    monthly: () => {
      const monthlyDatasets = [
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
      ];
      const chartEl = (
        <BarChart
          onClick={openBreakdown('monthly')}
          labels={vm.monthly.labels}
          datasets={monthlyDatasets}
          options={monthlyOptions}
        />
      );
      // 확대 모달 전용 — 그냥 크게 보이기만 하면 심심하다는 피드백에 따라 월별 매출/원가/손익 +
      // 누계(연 진행 추적)를 표로 함께 노출
      const modalContent = (
        <div className={styles.chartModalWithTable}>
          <div className={styles.chartModalChart}>{chartEl}</div>
          <div className={styles.chartModalBottom}>
            <div className={styles.chartModalTable}>
              <DataTable<MonthlyTableRow>
                data={monthlyRows}
                columns={monthlyRowColumns as never}
                getRowId={r => r.month}
                compact
                hideToolbar
                defaultPageSize={monthlyRows.length || 1}
                pageSizeOptions={[monthlyRows.length || 1]}
              />
            </div>
          </div>
        </div>
      );
      return (
        <ChartCard modalContent={modalContent} modalHeight="86vh">
          <ChartCard.Title><span className={styles.chartTitle}>월별 실적 추이<InfoButton>{INFO_MONTHLY}</InfoButton></span></ChartCard.Title>
          <ChartCard.Body>{chartEl}</ChartCard.Body>
        </ChartCard>
      );
    },
    planVsActual: () => {
      const makeChart = (hidden: ReadonlySet<string>) => {
        const idx = vm.planVsActual.labels.map((_, i) => i).filter(i => !hidden.has(vm.planVsActual.labels[i]));
        const pick = <T,>(arr: T[]) => idx.map(i => arr[i]);
        return (
          <BarChart
            horizontal
            onClick={openBreakdown('planVsActual')}
            labels={pick(vm.planVsActual.labels)}
            datasets={[
              { label: '계획(억)', data: pick(vm.planVsActual.planInitial), backgroundColor: planColor },
              { label: '추정 실적(억)', data: pick(vm.planVsActual.junCheckTotal), backgroundColor: palette.revenue },
            ]}
            options={planVsActualOptions}
          />
        );
      };
      // 카드는 항상 전체 파트, 체크 해제는 확대 모달 차트에만 적용
      const chartEl = makeChart(new Set());
      const { showRate } = vm.planVsActual;
      const total = vm.planVsActual.totalFor(pvaHidden);
      // 확대 모달 전용 — 차트(왼쪽) + 파트별 수치 표(오른쪽, 합계행). 파트 수가 적어 표가 작으니 양옆 배치
      const modalContent = (
        <div className={styles.chartModalSide}>
          <div className={styles.chartModalChart}>{makeChart(pvaHidden)}</div>
          <div className={styles.chartModalSideTable}>
            <div className={styles.chartModalTable}>
              <DataTable<PlanVsActualRow>
                data={vm.planVsActual.rows}
                columns={planVsActualColumns as never}
                getRowId={r => r.part}
                compact
                hideToolbar
                defaultPageSize={vm.planVsActual.rows.length || 1}
                pageSizeOptions={[vm.planVsActual.rows.length || 1]}
                footer={{
                  part: total.part,
                  plan: fmtEok(total.plan),
                  actual: fmtEok(total.actual),
                  diff: fmtDiff(total.diff),
                  ...(showRate ? { rate: total.rate == null ? '—' : `${total.rate}%` } : {}),
                }}
              />
            </div>
          </div>
        </div>
      );
      return (
        <ChartCard modalContent={modalContent}>
          <ChartCard.Title><span className={styles.chartTitle}>파트별 계획 vs 추정 실적<InfoButton>{INFO_PLAN_VS_ACTUAL}</InfoButton></span></ChartCard.Title>
          <ChartCard.Body>{chartEl}</ChartCard.Body>
        </ChartCard>
      );
    },
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
        togglePart(label);
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
      // 사이 카테고리 중앙에 점이 찍히는 문제가 있어(planLinePlugin 주석 참고) 대신 실제 막대
      // 엘리먼트 위치에 직접 그리는 방식으로 전환. 온오프는 커스텀 HTML 버튼이 아니라 —
      // "기존이랑 UI 통일 + x축 캔버스에서 관리해야지" 피드백에 따라 — Chart.js 기본 범례
      // (매출/원가가 이미 쓰던 그 범례) 안에 매출 계획/원가 계획 항목 2개를 끼워 넣어서, 클릭하면
      // 그 항목만 취소선 처리되는 Chart.js 기본 동작을 그대로 쓴다. 매출/원가 클릭은 기존
      // legendRadioClick(단독표시) 그대로 유지 — 여기서 새로 안 건드림
      // 계획선 색 = 대조 대상 막대와 같은 계열(매출 계획=파랑, 원가 계획=갈색)의 밝은 톤 — 둘 다
      // 같은 중립 회색(planColor)이라 어느 선이 어느 계획인지 헷갈렸음. 막대와 완전히 같은 색은
      // 계획 < 실적인 파트에서 선이 막대에 묻혀서 밝기를 달리함(palette.planRevenue/planCost, 2026-09-28)
      const planLineSeries = [
        ...(showPlanRevenue ? [{ barIndex: 0, values: pick(vm.profitRate.planRevenue), color: palette.planRevenue, dash: [6, 4] }] : []),
        ...(showPlanCost ? [{ barIndex: 1, values: pick(vm.profitRate.planCost), color: palette.planCost, dash: [3, 3] }] : []),
      ];
      const modalOptions = {
        ...partRevCostOptions,
        plugins: {
          ...partRevCostOptions.plugins,
          // 목표선이 막대 수치를 지나갈 때 글자 윤곽만 카드 배경색으로 둘러서 선이 글자 뒤로 가게
          datalabels: { ...partRevCostOptions.plugins?.datalabels, align: 'end' as const, textStrokeColor: surfaceColor, textStrokeWidth: 3 },
          // labelColor 생략 → 계획선 수치는 각 선 색으로(planLinePlugin 기본값)
          planLine: { series: planLineSeries, showLabels: vm.showLabels, surfaceColor },
          legend: {
            ...partRevCostOptions.plugins?.legend,
            labels: {
              generateLabels: (chart: Chart) => {
                // 항목을 직접 만들면 fontColor가 비어 Chart.js가 검정으로 그림 → 다크 모드에서 안 보였음.
                // 카드 범례(기본 generateLabels)와 같은 테마 기본색(chart.options.color = useChartTheme)으로
                const fontColor = chart.options.color as string;
                const barItems: LegendItem[] = chart.data.datasets.map((ds, i) => {
                  const meta = chart.getDatasetMeta(i);
                  const bg = Array.isArray(ds.backgroundColor) ? (ds.backgroundColor[0] as string) : (ds.backgroundColor as string);
                  return { text: ds.label ?? '', datasetIndex: i, fillStyle: bg, strokeStyle: bg, lineWidth: 0, hidden: !!meta.hidden, fontColor } as LegendItem;
                });
                const planItems: LegendItem[] = [
                  { text: '매출 계획', datasetIndex: -1, fillStyle: palette.planRevenue, strokeStyle: palette.planRevenue, lineWidth: 0, hidden: !showPlanRevenue, fontColor } as LegendItem,
                  { text: '원가 계획', datasetIndex: -2, fillStyle: palette.planCost, strokeStyle: palette.planCost, lineWidth: 0, hidden: !showPlanCost, fontColor } as LegendItem,
                ];
                return [...barItems, ...planItems];
              },
            },
            onClick: (e: ChartEvent, legendItem: LegendItem, legend: LegendElement<'bar'>) => {
              if (legendItem.datasetIndex === -1) { setShowPlanRevenue(v => !v); return; }
              if (legendItem.datasetIndex === -2) { setShowPlanCost(v => !v); return; }
              legendRadioClick(e, legendItem, legend);
            },
          },
        },
      };
      const modalChartEl = (
        <BarChart
          // exportable   // PNG 내보내기 — 일단 주석 처리(마음에 들지만 보류)
          onClick={handleAxisToggle}
          labels={visibleLabels}
          datasets={baseDatasets}
          options={modalOptions}
          plugins={[planLinePlugin]}
        />
      );
      const modalContent = (
        <div className={styles.chartModalWithTable}>
          <div className={styles.chartModalChart}>{modalChartEl}</div>
          <div className={styles.chartModalBottom}>
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
            <div className={styles.chartModalControls}>
              <span className={styles.chartModalControlsTitle}>파트 표시</span>
              {vm.profitRate.labels.map(part => (
                <label key={part} className={styles.partCheckItem}>
                  <input
                    type="checkbox"
                    className={styles.partCheckbox}
                    checked={!hiddenParts.has(part)}
                    onChange={() => togglePart(part)}
                  />
                  <span>{stripPartPrefix(part) || part}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      );
      return (
        <ChartCard modalContent={modalContent} modalHeight="88vh">
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
            onSliceClick={i => openTarget({
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
            outsideLabelsSize="md"
            onSliceClick={i => openTarget({
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
    : chartState === 'empty' ? <ChartStateGrid variant="empty" icon={<LineIcon kind="chart" />} message="데이터 없음" ids={chartOrder} />
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
