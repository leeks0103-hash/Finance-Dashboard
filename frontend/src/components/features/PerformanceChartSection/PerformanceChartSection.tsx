import { useMemo, useState, useCallback, type ReactNode, type CSSProperties } from 'react';
import {
  DndContext, DragOverlay, closestCenter, pointerWithin,
  type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { createPortal } from 'react-dom';
import { CSS } from '@dnd-kit/utilities';
import {
  SortableContext, useSortable, arrayMove, type SortingStrategy,
} from '@dnd-kit/sortable';
import { usePerformanceChartViewModel } from '@/hooks/viewmodels';
import type { MonthlyTableRow, PlanVsActualRow } from '@/hooks/viewmodels/usePerformanceChartViewModel';
import { useTheme } from '@/hooks';
import { makeBarOptions, legendRadioClick } from '@/utils/chartOptions';
import { getChartTheme } from '@/utils/chartColors';
import { useChartPalette } from '@/hooks/useChartPalette';
import { useUiStore } from '@/store';
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
  INFO_PLAN_VS_ACTUAL, infoPerCapita,
} from '@/utils/infoTexts';
import type { ChartDataset, ChartOptions } from 'chart.js';
import { stripPartPrefix, prefersReducedMotion, formatHeadcount } from '@/utils/format';
import { getDatalabelAlpha } from '@/utils/datalabelFade';
import { CHART_TUNING, tuningLabelFont, tuningBarSize, tuningTickFont, px } from './chartTuning';   // 차트별 여백·굵기·글자 조절표(2026-10-27)
import { SORTABLE_TRANSITION } from '@/components/ui/sortableMotion';
import styles from './PerformanceChartSection.module.css';

// 레이아웃(2026-10-23 요청): 1줄 = 진도율(월별 실적 추이, 8칸) + 파트별 매출 진행 현황(4칸 — 예전엔 차트 아래 따로 있던 섹션)
//                          2줄 = 원가분석(파트별 추정 매출/원가, 8칸) + 전체 평균 원가 비율 도넛(4칸) — 2줄은 더 높게
//                          (인원 줄) 파트별 인원 — 원가분석 줄과 계획 vs 추정 매출 줄 사이, 한 줄 전체(12칸, 낮게. 2026-10-23 요청)
//                          3줄 = 파트별 계획 vs 추정 실적 · 인당 매출 · 인당 손익 · 인당 관리비 — 한 줄에 4개(3칸×4, 2026-10-23 요청. 파트 인원은 관리자가 수기 입력)
//                          (한 줄에 하나씩 12칸으로 쌓아 봤다가 한 줄 4개로 확정. 예전: 3줄 = 인당 3개(4칸×3) / 4줄 = 계획 vs 추정 실적)
// (2026-10-20엔 1줄 = 월별 8 + 도넛 4 / 2줄 = 파트별 매출/원가 8 + 계획 vs 추정 4). 'progress'(진행단계별)는 요청에 따라 비활성
// 줄(행) 구성은 고정 — 같은 줄 안에서 좌우 순서만 바꿀 수 있고, 카드가 다른 줄로 가거나 줄 자체를 위아래로 옮길 수는 없음(2026-10-23 요청)
const DEFAULT_CHART_ORDER = ['monthly', 'achievement', 'profitRate', 'costBreakdown', 'headcount', 'planVsActual', 'perCapitaRevenue', 'perCapitaMgmt', 'perCapitaProfit'];
// 배치가 바뀌어 저장된 옛 순서로는 줄이 어긋나 키를 올림 — 한 번 기본 순서로 돌아감
const LS_CHART_ORDER = 'performance-chart-order-v8';

// 카드별 고정 폭(12칸 그리드 span) + 높이 — 슬롯이 아니라 '카드'에 붙어서 드래그로 순서를 바꿔도 크기 유지.
// 한 줄 합 = 12. 높이는 같은 줄에서 큰 쪽에 맞춰 늘어남(grid stretch)
type SpanKey = 'span12' | 'span9' | 'span8' | 'span4' | 'span3';
const SPAN_BY_ID: Record<string, readonly [SpanKey, 'rowShort' | 'rowTall' | 'rowLow']> = {
  monthly:       ['span8', 'rowShort'],   // 진도율(월별 실적 추이)
  achievement:   ['span4', 'rowShort'],   // 파트별 매출 진행 현황 — 월별 옆(2026-10-23)
  profitRate:    ['span8', 'rowTall'],    // 원가분석(파트별 추정 매출/원가) — 크게
  costBreakdown: ['span4', 'rowTall'],    // 전체 평균 원가 비율 도넛 — 원가분석 옆(2026-10-23)
  headcount:     ['span12', 'rowLow'],    // 파트별 인원 — 원가분석 줄 아래 한 줄(낮게)
  planVsActual:  ['span3', 'rowShort'],   // 파트별 계획 vs 추정 실적 — 3줄 맨 앞(3칸, 한 줄 4개)
  perCapitaRevenue: ['span3', 'rowShort'],  // 파트별 인당 매출(계획 vs 추정) — 3칸(한 줄 4개)
  perCapitaProfit:  ['span3', 'rowShort'],  // 파트별 인당 손익(추정)
  perCapitaMgmt:    ['span3', 'rowShort'],  // 파트별 인당 관리비(추정)
};
const staticPreview: SortingStrategy = () => null;

// 순서를 줄(합 12칸) 단위로 나눔
const SPAN_COLS: Record<SpanKey, number> = { span12: 12, span9: 9, span8: 8, span4: 4, span3: 3 };
const splitChartRows = (order: string[]) => {
  const rows: string[][] = [];
  let cur: string[] = [], sum = 0;
  for (const id of order) {
    cur.push(id);
    sum += SPAN_COLS[(SPAN_BY_ID[id] ?? ['span4'])[0]];
    if (sum >= 12) { rows.push(cur); cur = []; sum = 0; }
  }
  if (cur.length) rows.push(cur);
  return rows;
};
// 기본 배치의 줄 구성 — 이 줄 구성을 그대로 지키는 순서만 유효(2026-10-23: 같은 줄 안 좌우 교체만 허용).
// 예전엔 합이 12칸이 되기만 하면 줄 간 이동·줄 통째 바꾸기(핸들 더블클릭)도 허용했음(2026-10-20)
const DEFAULT_CHART_ROWS = splitChartRows(DEFAULT_CHART_ORDER);
const isValidChartOrder = (order: string[]) => {
  const rows = splitChartRows(order);
  return rows.length === DEFAULT_CHART_ROWS.length
    && rows.every((r, i) => r.length === DEFAULT_CHART_ROWS[i].length && r.every(id => DEFAULT_CHART_ROWS[i].includes(id)));
};
// 드래그 중 커서를 따라다니는 작은 카드(DragOverlay)에 쓸 제목 — 큰 차트 카드를 통째로 끌면 크기가 달라
// (9·8·4·3칸) 움직임이 어색하고 화면 밖으로 밀렸음. 원래 카드는 제자리에 흐리게 남고 이 미니 카드만 움직임(2026-10-20)
const CHART_TITLES: Record<string, string> = {
  monthly: '진도율(월별 실적 추이)',
  achievement: '파트별 매출 실적 진행 현황',
  costBreakdown: '전체 평균 원가 비율',
  profitRate: '원가분석(파트별 추정 매출/원가)',
  headcount: '파트별 인원',
  planVsActual: '파트별 계획 매출 vs 추정 매출',
  perCapitaRevenue: '파트별 인당 매출',
  perCapitaProfit: '파트별 인당 손익',
  perCapitaMgmt: '파트별 인당 관리비',
};
const OVERLAY_DROP_ANIMATION = { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };

const cardClass = (id: string) => (SPAN_BY_ID[id] ?? ['span4', 'rowShort']).map(k => styles[k]).join(' ');

// 파트별 경상이익 카드 전용 여백 — 그래프 면적을 최대한 넓게 쓰기 위해 직접 지정한다.
// makeBarOptions의 최소 여백(right 58 / top 30)은 가로 막대 차트가 막대 오른쪽에 수치를 찍기
// 위한 값이라 세로 막대인 이 차트에서는 낭비된다. resolvePadding이 max()로만 키우므로 여기서 덮어씀.
// bottom은 마이너스 막대의 수치가 막대 아래에 찍히는 것만 감당하면 되므로 최소로 둔다.
// (PROFIT_PADDING은 chartTuning.ts의 profitRate.padding으로 이동 — 2026-10-27)

// 이익율/이익액 토글 비활성화로 미사용(주석 처리) — 매출/원가는 항상 0 이상이라 부호 분기 불필요.
// 복구 시 profitRateOptions/profitAmountOptions와 함께 해제
// const PROFIT_LABEL = {
//   anchor: 'end' as const,
//   align:  (ctx: { dataset: { data: unknown[] }; dataIndex: number }) =>
//     (Number(ctx.dataset.data[ctx.dataIndex]) >= 0 ? 'top' : 'bottom'),
//   offset: 6,   // 막대 끝과 수치 사이 간격 — 2는 붙어 보여서 키움 (위/아래 동일 적용)
// };

// "파트별 추정 매출/원가" 확대 모달의 검증용 표 — 컬럼은 상태 의존 없어 모듈 스코프
interface PartRevCostRow { part: string; revenue: number; cost: number; overhead: number; costRate: number | null; profit: number; }
const prc = createColumnHelper<PartRevCostRow>();
const partRevCostColumns = [
  prc.accessor('part',     { header: '파트',        size: 110 }),
  prc.accessor('revenue',  { header: '매출(억)',    size: 100, cell: i => i.getValue().toLocaleString() }),
  prc.accessor('cost',     { header: '직접원가(억)', size: 100, cell: i => i.getValue().toLocaleString() }),
  prc.accessor('overhead', { header: '공통원가(억)', size: 100, cell: i => i.getValue().toLocaleString() }),
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
//   · 껐을 때(exit) — 그릴 때의 반대로 오른쪽 → 왼쪽으로 걷힘. 예전엔 범례를 누르는 순간 뚝 사라졌음(2026-09-30)
const PLAN_ANIM_MS = 900;
const PLAN_EXIT_MS = 500;
const easeInOutQuart = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);
interface PlanTween {
  from: (number | null)[]; to: (number | null)[]; start: number; reveal: boolean;
  /** 마지막으로 그린 모양 — 꺼진 뒤(옵션에서 빠진 뒤)에도 퇴장 동안 같은 색·점선으로 그리려고 보관 */
  color: string; dash: number[];
  /** 퇴장 중이면 시작 시각 + 그때 보이던 폭 비율(그리는 도중에 끄면 그린 데까지만 걷힘) */
  exit?: { start: number; from: number };
}
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
const PLAN_FONT = "bold 12px 'Pretendard', 'Malgun Gothic', sans-serif";
const LABEL_H = 16;       // 12px 글자 + 위아래 여백 — 막대 수치(datalabels padding)와 같은 높이
const LABEL_PAD_X = 3;
// 파트별 추정 매출/원가(메인 카드) — 원가 수치만 오른쪽으로 미는 양(px, 소수 가능). 막대는 그대로.
// datalabels엔 가로 오프셋 옵션이 없고 padding은 배경 박스만 키울 뿐 글자는 항상 기준점 가운데라
// (boundingRects: text.x = -w/2 고정) 안 움직임 — 대신 align을 '막대 위(-90°)'에서 아주 조금 기울여
// 가로 이동량이 정확히 COST_LABEL_SHIFT가 되게 각도를 계산(가로 이동 ≈ (박스폭/2 + offset)·tanθ)
const COST_LABEL_SHIFT = 1.1;
const REV_COST_LABEL_FONT = "bold 12px 'Pretendard', 'Malgun Gothic', sans-serif";
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
// 원가 2층 막대의 층 안 수치 — 가운데 흰 글자. 막대가 좁아 '억' 없이 숫자만 작게(합계는 막대 위에 '억' 붙여 따로).
// 층이 글자보다 낮거나 좁으면 생략 — 그 값은 마우스 올림·확대 표에서(2026-10-20)
// 층 막대는 보기용 높이(data)와 실제값(realData)이 다를 수 있음 — 숫자·툴팁은 항상 실제값(2026-10-20)
type RealDataset = { data: unknown[]; realData?: number[] };
const realValue = (ctx: { dataIndex: number; dataset: unknown }) => {
  const d = ctx.dataset as RealDataset;
  return d.realData?.[ctx.dataIndex] ?? Number(d.data[ctx.dataIndex]);
};
// 원가 2층 보기용 높이(2026-10-20) — 직접원가에 비해 공통원가가 너무 얇아(5~10배 이상 차이) 층 안에 숫자가 안 들어가고
// 오른쪽으로 삐져나오던 것. 원가 막대 전체 높이(= 실제 합계)는 그대로 두고 두 층의 경계만 옮겨 공통원가 층을 키움 —
// 매출 막대와의 비교·막대 위 합계·원가율은 실제와 같고, 층 안 숫자·툴팁도 실제값(realData).
// 공통원가 층 최소 높이 = max(막대의 20%, 화면 18px) — 비율만 쓰면 PM처럼 막대 자체가 짧은 파트는 20%여도 몇 px라
// 숫자가 안 들어가서 화면 픽셀 기준도 둠(단 막대의 절반은 넘지 않게). 공통원가가 직접원가보다 크면 그대로
const OVERHEAD_MIN_SHARE = 0.2;
const OVERHEAD_MIN_PX = 18;
const layerBoostPlugin: Plugin<'bar'> = {
  id: 'layerBoost',
  // 축 크기가 정해진 뒤에야 px ↔ 억 환산이 되므로 그린 뒤 계산해서 다르면 한 번 더 그림(전체 합은 같아 축이 안 바뀌어 반복 없음)
  afterUpdate(chart) {
    type LayerDs = { data: number[]; realData?: number[] };
    const direct = chart.data.datasets[1] as unknown as LayerDs | undefined;
    const overhead = chart.data.datasets[2] as unknown as LayerDs | undefined;
    const y = chart.scales.y;
    if (!direct?.realData || !overhead?.realData || !y) return;
    let nextD = direct.realData, nextO = overhead.realData;
    // 공통원가를 범례로 숨기면 직접원가는 실제 높이 그대로
    if (chart.isDatasetVisible(2) && chart.isDatasetVisible(1)) {
      const upp = (y.max - y.min) / Math.max(1, y.bottom - y.top);   // 1px당 억
      nextD = []; nextO = [];
      direct.realData.forEach((d, i) => {
        const o = overhead.realData![i] ?? 0;
        const t = d + o;
        const minO = Math.max(t * OVERHEAD_MIN_SHARE, Math.min(OVERHEAD_MIN_PX * upp, t * 0.5));
        const boosted = o > 0 && d > o && o < minO;
        nextO.push(boosted ? minO : o);
        nextD.push(boosted ? t - minO : d);
      });
    }
    const same = (p: number[], q: number[]) => p.length === q.length && p.every((v, i) => Math.abs(v - (q[i] ?? 0)) < 1e-6);
    if (same(direct.data, nextD) && same(overhead.data, nextO)) return;
    direct.data = nextD;
    overhead.data = nextO;
    chart.update();
  },
};
const SEGMENT_FONT = { size: 10, weight: 'bold' as const, family: "'Pretendard', 'Malgun Gothic', sans-serif" };
type SegCtx = { chart: Chart; datasetIndex: number; dataIndex: number; dataset: { data: unknown[]; backgroundColor?: unknown } };
type SegEl = { y: number; base: number; width: number };
// 막대의 '애니메이션이 끝난 뒤' 위치·크기(getProps(…, true)) — 그냥 el.y/base를 읽으면 처음 그릴 때(막대가 0에서 자라는 중)
// 높이가 0이라 '안 들어감'으로 판정돼 층 안 숫자가 안 보이다가, 마우스를 올려 다시 그려야 나타났음(2026-10-20)
const segEl = (ctx: SegCtx): SegEl | undefined => {
  const el = ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.dataIndex] as unknown as
    { getProps?: (keys: string[], final?: boolean) => SegEl } | undefined;
  return el?.getProps?.(['y', 'base', 'width'], true);
};
// 데이터셋에 display를 주면 '그래프 수치' 토글(옵션의 display)을 덮어써서 직접 따름
const labelsOn = (ctx: SegCtx) =>
  (ctx.chart.options.plugins as { datalabels?: { display?: unknown } } | undefined)?.datalabels?.display !== false;
// 층 안에 숫자가 들어가는지 — 높이 12px 이상, 글자 폭이 막대 폭 안
const segFits = (ctx: SegCtx) => {
  const el = segEl(ctx);
  if (!el || Math.abs(el.base - el.y) < 12) return false;
  const c = ctx.chart.ctx;
  c.save();
  c.font = `bold ${SEGMENT_FONT.size}px ${SEGMENT_FONT.family}`;
  const w = c.measureText(String(realValue(ctx))).width;
  c.restore();
  return w <= el.width - 2;
};
const SEGMENT_LABEL = {
  anchor: 'center' as const,
  align: 'center' as const,
  offset: 0,
  padding: 0,
  color: '#FFFFFF',
  textStrokeWidth: 0,
  font: SEGMENT_FONT,
  formatter: (_: number, ctx: SegCtx) => `${realValue(ctx)}`,
  display: (ctx: SegCtx) => labelsOn(ctx) && segFits(ctx),
};
// 공통원가 층이 얇아 안에 안 들어가면 — 그 층 높이에 맞춰 막대 바로 오른쪽 빈 틈(다음 파트 매출 막대 전)에 층 색 숫자.
// 화면 구성은 그대로 두고 숫자만 항상 보이게(대표님이 보신 화면 유지, 2026-10-20). 0이면 표시 안 함
const SIDE_LABEL = {
  anchor: 'center' as const,
  align: 0,
  offset: (ctx: SegCtx) => (segEl(ctx)?.width ?? 0) / 2 + 2,
  padding: 0,
  textStrokeWidth: 0,
  font: SEGMENT_FONT,
  color: (ctx: SegCtx) => {
    const bg = ctx.dataset.backgroundColor;
    return (Array.isArray(bg) ? bg[ctx.dataIndex] : bg) as string;
  },
  formatter: (_: number, ctx: SegCtx) => `${realValue(ctx)}`,
  display: (ctx: SegCtx) => labelsOn(ctx) && realValue(ctx) > 0 && !segFits(ctx),
};
// ⚠️ 아래 costRatePlugin·tightLabelsPlugin·tightTicksPlugin·fitBarLabelsPlugin·breakAtDotTick·costRateTuning은 2027 계획 보기 차트
// (PerformancePlanChartSection)도 그대로 가져다 씀(2026-10-29 — 2026/2027 글자 크기·자간·두 줄 파트명이 같아야 한다는 요청). 이름·동작을 바꾸면 양쪽에 반영됨.
// 원가율 — "원가 ÷ 매출"을 원가 막대 위, 원가 합계 수치 바로 위에 괄호로 "(54.8%)"(2026-10-21 시안 요청).
// 그 전엔 막대 발치(가로축 아래) → 두 막대 경계 위(더 높은 막대 기준)였음.
// 원가 = 원가 막대 전체(직접원가 + 공통원가, 보이는 막대 높이 그대로). 데이터셋 순서: 0 매출 / 1 직접원가 / 2 공통원가.
// 매출·원가 중 하나라도 숨기면(범례) 안 그림, '그래프 수치' 토글을 따름
// 월별 실적 추이도 같은 플러그인(2026-10-21 요청) — 데이터셋 0 매출 / 1 원가(층 없음). 막대가 좁으면 안 그림(minBarWidth)
interface CostRateOpts { show: boolean; text: string; minBarWidth?: number; lift?: number; font?: string; spacing?: string }   // lift: 차트별 높이(기본 COST_RATE_LIFT), font: 차트별 글꼴(기본 COST_RATE_FONT)
const COST_RATE_FONT = "bold 12px 'Pretendard', 'Malgun Gothic', sans-serif";
const COST_RATE_LIFT = 41;   // 원가 막대 꼭대기에서 이만큼 위 — 원가 합계 수치 상자(offset 4 + 14px 글자 + 위아래 padding 4 = 막대 위 약 29px) 윗줄 + 간격, 겹쳐 보여 27 → 41
export const costRatePlugin: Plugin<'bar'> = {
  id: 'costRate',
  afterDatasetsDraw(chart) {
    const o = (chart.options.plugins as { costRate?: CostRateOpts } | undefined)?.costRate;
    if (!o?.show) return;
    const metas = [0, 1, 2].map(i => chart.getDatasetMeta(i));
    if (!metas[0] || !metas[1] || !chart.isDatasetVisible(0) || !chart.isDatasetVisible(1)) return;
    const data = chart.data.datasets.map(d => d.data as number[]);
    const showOverhead = chart.data.datasets.length > 2 && chart.isDatasetVisible(2);
    const { ctx } = chart;
    ctx.save();
    ctx.globalAlpha = getDatalabelAlpha();
    ctx.font = o.font ?? COST_RATE_FONT;
    // 원가율 글씨만의 자간(선택, 조절표 costRate.spacing) — 없으면 차트 전체 자간(tightLabels)을 그대로 따름. save/restore가 되돌림
    if (o.spacing) (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = o.spacing;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    metas[0].data.forEach((_revEl, i) => {
      const rev = Number(data[0]?.[i]) || 0;
      const cost = (Number(data[1]?.[i]) || 0) + (showOverhead ? Number(data[2]?.[i]) || 0 : 0);
      const costEl = (showOverhead ? metas[2] : metas[1]).data[i] as unknown as { x: number; y: number; base: number; width: number } | undefined;
      if (!costEl || rev <= 0 || cost <= 0) return;
      if (o.minBarWidth && costEl.width < o.minBarWidth) return;
      const text = `(${Math.round((cost / rev) * 1000) / 10}%)`;
      const x = costEl.x;   // 원가 막대 가운데
      // 원가 꼭대기 = 위층(공통원가, 숨기면 직접원가) 막대의 y
      const y = Math.max(costEl.y - (o.lift ?? COST_RATE_LIFT), chart.chartArea.top - 52);   // 차트 위 여백 밖으로는 안 나가게
      // 알약 테두리·배경은 뺌 — 원가색 테두리가 촌스럽다는 피드백, 수치만(2026-10-20)
      ctx.fillStyle = o.text;
      ctx.fillText(text, x, y + 0.5);
    });
    ctx.restore();
  },
};

// 원가율을 막대 위 별도 글씨(costRatePlugin) 대신 **원가 수치 라벨의 둘째 줄** "(54.8%)"로 — 글자색이 수치와 같고 개행만 함(2026-10-29 시도, 요청).
// 월별 계획 분배(2027)·진도율(월별 실적 추이)·원가분석에 적용. 마음에 안 들면 false — costRatePlugin이 예전처럼 막대 위에 따로 그림(옵션 show가 !INLINE_COST_RATE를 따름)
export const INLINE_COST_RATE = false;   // 2026-10-29: 둘째 줄 방식을 시도했다가 "퍼센트 수치 위치 롤백" 요청으로 끔 — 원가율은 예전처럼 막대 위 별도 글씨(costRatePlugin). 다시 쓰려면 true
/** i번째 막대의 원가율 글자 "(54.8%)" — 매출(데이터셋 0) 대비 원가(데이터셋 1 + 보이는 공통원가 2), costRatePlugin과 같은 계산. 값이 없거나 매출·원가를 숨겼으면 null */
export const costRateText = (chart: Chart, i: number): string | null => {
  if (!chart.isDatasetVisible(0) || !chart.isDatasetVisible(1)) return null;
  const num = (di: number) => {
    const d = chart.data.datasets[di] as unknown as { data: unknown[]; realData?: number[] } | undefined;
    return Number(d?.realData?.[i] ?? d?.data[i]) || 0;
  };
  const rev = num(0);
  const cost = num(1) + (chart.data.datasets.length > 2 && chart.isDatasetVisible(2) ? num(2) : 0);
  return rev > 0 && cost > 0 ? `(${Math.round((cost / rev) * 1000) / 10}%)` : null;
};

// 막대 위 수치 자간 좁히기(진도율 차트, 2026-10-23 요청) — chartjs-plugin-datalabels는 자간 옵션이 없어서,
// 수치가 그려지기 직전(beforeDatasetsDraw)에 캔버스 letterSpacing을 걸고 그리기가 끝나면(afterDraw) 되돌림.
// datalabels·costRate 둘 다 이 값을 물려받음. 축 눈금(그 전에 그려짐)엔 영향 없음
type SpacedCtx = CanvasRenderingContext2D & { letterSpacing?: string };
// whiteSpacing(선택, 2026-10-29) — 막대 **안쪽 흰색** 수치(원가분석의 층 안 숫자)만 다른 자간. datalabels는 라벨마다 자간을 못 주므로
// 수치가 그려지는 동안(beforeDatasetsDraw ~ afterDatasetsDraw) ctx.fillText를 감싸 글자색이 흰색일 때만 whiteSpacing, 나머지는 spacing.
// 감싼 걸 afterDatasetsDraw에서 바로 풀어 툴팁·범례 등 뒤에 그려지는 글씨엔 영향 없음(그 뒤 letterSpacing 기본 복원은 afterDraw)
type TightLabelsOpts = { spacing: string; whiteSpacing?: string };
type PatchedCtx = SpacedCtx & { _tightFillText?: boolean };
const unpatchFillText = (ctx: PatchedCtx) => {
  if (!ctx._tightFillText) return;
  delete (ctx as { fillText?: unknown }).fillText;   // 인스턴스에 얹은 것만 지워 원래(프로토타입) fillText로 복귀
  ctx._tightFillText = false;
};
export const tightLabelsPlugin: Plugin<'bar'> = {
  id: 'tightLabels',
  beforeDatasetsDraw(chart) {
    const o = (chart.options.plugins as { tightLabels?: TightLabelsOpts } | undefined)?.tightLabels;
    const ctx = chart.ctx as PatchedCtx;
    if (o?.spacing) ctx.letterSpacing = o.spacing;
    if (o?.whiteSpacing && !ctx._tightFillText) {
      const orig = ctx.fillText;
      const { spacing, whiteSpacing } = o;
      ctx.fillText = function (this: PatchedCtx, ...args: Parameters<CanvasRenderingContext2D['fillText']>) {
        // fillStyle은 읽을 때 "#ffffff"로 정규화됨(#FFF·#fff·#FFFFFF 모두)
        this.letterSpacing = String(this.fillStyle).toLowerCase() === '#ffffff' ? whiteSpacing : spacing;
        return orig.apply(this, args);
      } as CanvasRenderingContext2D['fillText'];
      ctx._tightFillText = true;
    }
  },
  afterDatasetsDraw(chart) {
    unpatchFillText(chart.ctx as PatchedCtx);
  },
  afterDraw(chart) {
    unpatchFillText(chart.ctx as PatchedCtx);   // 그리기가 중간에 취소돼도 남지 않게 한 번 더
    (chart.ctx as SpacedCtx).letterSpacing = '0px';
  },
};

// 조절표(chartTuning.ts)의 costRate → costRatePlugin 옵션(위치 lift·글자 font·좁은 막대 생략 minBarWidth)
export const costRateTuning = (t: { costRate?: { lift: number; fontPx: number; minBarWidth?: number; spacing?: number } }) => t.costRate ? {
  lift: t.costRate.lift,
  font: `bold ${t.costRate.fontPx}px 'Pretendard', 'Malgun Gothic', sans-serif`,
  ...(t.costRate.minBarWidth != null ? { minBarWidth: t.costRate.minBarWidth } : {}),
  ...(t.costRate.spacing != null ? { spacing: px(t.costRate.spacing) } : {}),
} : {};

// 파트명 축 글자를 가운데점(ㆍ)에서 두 줄로 — Chart.js 눈금 callback이 배열을 돌려주면 여러 줄로 그림. 라벨 데이터는 그대로라 클릭·툴팁은 원래 이름
// (조절표 breakTickAtDot, 2026-10-27). 점이 없거나 짧은 이름("AIㆍDS" 5자)은 그대로 한 줄 — 이 글자 수 이상일 때만 나눔
const BREAK_AT_DOT_MIN_LEN = 7;
export const breakAtDotTick = function (this: { getLabelForValue: (v: number) => string }, v: string | number) {
  const label = this.getLabelForValue(Number(v));
  const at = label.indexOf('ㆍ');
  return label.length >= BREAK_AT_DOT_MIN_LEN && at > 0 && at < label.length - 1 ? [label.slice(0, at + 1), label.slice(at + 1)] : label;
};

const overlaps = (a: Rect, b: Rect) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

// 한 계열(점선 + 점)을 그림 — clipX가 있으면 차트 왼쪽 끝부터 거기까지만 보이게
const strokePlanSeries = (chart: Chart<'bar'>, pts: (PlanPt | null)[], color: string, dash: number[], clipX: number) => {
  const { ctx } = chart;
  const { left, top, bottom } = chart.chartArea;
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
};

const drawPlanLines = (chart: Chart<'bar'>) => {
  const drawn: PlanDrawn[] = [];
  planDrawn.set(chart, drawn);
  const opts = (chart.options.plugins as { planLine?: PlanLinePluginOpts } | undefined)?.planLine;
  const series = opts?.series ?? [];
  const tweens = planTweens.get(chart) ?? new Map<number, PlanTween>();
  planTweens.set(chart, tweens);
  if (!series.length && !tweens.size) return;
  const now = performance.now();
  let animating = false;
  const { left, right } = chart.chartArea;
  const ptsOf = (barIndex: number, values: (number | null)[], labels: (number | null)[]) => {
    const meta = chart.getDatasetMeta(barIndex);
    const yScale = chart.scales[meta?.yAxisID ?? 'y'];
    if (!meta?.data?.length || !yScale) return null;
    return meta.data.map((el, i) => {
      const v = values[i];
      if (v == null) return null;
      return { x: (el as unknown as { x: number }).x, y: yScale.getPixelForValue(v), v: labels[i] ?? null };
    });
  };

  series.forEach(({ barIndex, values: targets, color, dash }) => {
    let tw = tweens.get(barIndex);
    // 걷히는 도중에 다시 켜면 처음부터 다시 그려 나감
    if (tw?.exit) { tweens.delete(barIndex); tw = undefined; }
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
        color, dash,
      };
      tweens.set(barIndex, tw);
    }
    tw!.color = color;
    tw!.dash = dash;
    const t = Math.min(1, (now - tw!.start) / PLAN_ANIM_MS);
    if (t < 1) animating = true;
    const e = easeInOutQuart(t);
    const values = tw!.reveal ? targets : targets.map((_, i) => tweenValueAt(tw!, i, e));
    // reveal이면 차트 왼쪽 끝부터 진행률만큼만 보이게
    const clipX = tw!.reveal && t < 1 ? left + (right - left) * e : Infinity;
    // 수치 라벨은 datalabels가 못 봄(실제 데이터셋이 아니라 캔버스 직접 그리기) — 3단계에서 직접 그림.
    // 라벨 수치는 트윈 중간값이 아니라 최종 목표값(targets) — 위치만 움직이고 숫자는 고정
    const pts = ptsOf(barIndex, values, targets);
    if (!pts) return;
    drawn.push({ pts, color, clipX });
    strokePlanSeries(chart, pts, color, dash, clipX);
  });

  // 꺼진 계열 — 바로 지우지 않고 오른쪽부터 걷어냄. 끝나면 상태를 버려서 다시 켤 때 처음부터 그려지게
  tweens.forEach((tw, barIndex) => {
    if (series.some(sr => sr.barIndex === barIndex)) return;
    if (!tw.exit) {
      const t = Math.min(1, (now - tw.start) / PLAN_ANIM_MS);
      tw.exit = { start: now, from: tw.reveal ? easeInOutQuart(t) : 1 };
    }
    const te = Math.min(1, (now - tw.exit.start) / PLAN_EXIT_MS);
    if (te >= 1 || prefersReducedMotion()) { tweens.delete(barIndex); return; }
    animating = true;
    const pts = ptsOf(barIndex, tw.to, tw.to);
    if (!pts) { tweens.delete(barIndex); return; }
    const clipX = left + (right - left) * tw.exit.from * (1 - easeInOutQuart(te));
    drawn.push({ pts, color: tw.color, clipX });
    strokePlanSeries(chart, pts, tw.color, tw.dash, clipX);
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
// 가로 막대 끝 수치("22.8억 (101.3%)")가 그래프 안에 딱 들어가게 값 축(x) 끝을 늘림(2026-10-20).
// 예전엔 오른쪽 여백 104px 고정 + 축 grace 15%로 빈 공간을 두 번 잡아 그래프가 좁았음 — 막대마다
// "막대 끝 + 글자 폭 ≤ 그래프 오른쪽"이 되는 최소 축 끝을 계산(짧은 막대 수치는 원래 빈 공간을 씀).
// 그래프 폭은 직전 배치값을 쓰고, 처음 한 번은 어림값 — 다음 그리기에서 맞춰짐. 글자는 makeBarOptions datalabels와 같게
interface FitBarLabelsOpts { show: boolean; showRate: boolean; fontPx?: number; spacing?: number }   // fontPx·spacing: 수치 글자 크기·자간(px, chartTuning.ts) — 폭 재기를 실제 글자와 맞춤
const FIT_LABEL_FONT = "bold 14px 'Pretendard', 'Malgun Gothic', sans-serif";
// 세로축(파트명) 글자 자간 좁히기(2026-10-21) — "전동화&차량개발"처럼 긴 파트명이 축 칸을 다 잡아먹어서.
// Chart.js 눈금엔 자간 옵션이 없어 y축의 update(글자 폭 재기·칸 맞추기)·drawLabels(그리기)를 감싸 canvas letterSpacing을 그동안만 켬.
// 폭 재기도 같은 자간으로 해야 축 칸이 실제로 줄어듦(measureText가 letterSpacing을 반영)
const TICK_LETTER_SPACING = '-1px';
// 옵션 plugins.tightTicks = { spacing: '-1px', axes: ['y'] } — 자간(기본 -1px)·적용 축(기본 y = 가로 막대의 왼쪽 파트명, 세로 막대는 ['x']).
// 값은 chartTuning.ts의 tickSpacing에서 옴. 폭 재기·그리기 때 옵션을 그때그때 읽어서 값을 바꿔도 바로 반영
interface TightTicksOpts { spacing?: string; axes?: ('x' | 'y')[] }
export const tightTicksPlugin: Plugin<'bar'> = {
  id: 'tightTicks',
  beforeLayout(chart) {
    const readOpts = () => (chart.options.plugins as { tightTicks?: TightTicksOpts } | undefined)?.tightTicks;
    (readOpts()?.axes ?? ['y']).forEach(axis => {
      const sc = chart.scales[axis] as unknown as { update: (...a: unknown[]) => void; drawLabels: (a: unknown) => void; _tight?: boolean } | undefined;
      if (!sc || sc._tight) return;
      sc._tight = true;
      const ctx = chart.ctx as CanvasRenderingContext2D & { letterSpacing?: string };
      const wrap = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => {
        const prev = ctx.letterSpacing;
        ctx.letterSpacing = readOpts()?.spacing ?? TICK_LETTER_SPACING;
        try { fn(...a); } finally { ctx.letterSpacing = prev ?? '0px'; }
      };
      sc.update = wrap(sc.update.bind(sc));
      sc.drawLabels = wrap(sc.drawLabels.bind(sc));
    });
  },
};

export const fitBarLabelsPlugin: Plugin<'bar'> = {
  id: 'fitBarLabels',
  afterDataLimits(chart, args) {
    const o = (chart.options.plugins as { fitBarLabels?: FitBarLabelsOpts } | undefined)?.fitBarLabels;
    const scale = (args as { scale: { id: string; max: number; min: number } }).scale;
    if (!o?.show || scale.id !== 'x' || scale.max <= 0) return;
    const w = chart.chartArea ? chart.chartArea.right - chart.chartArea.left : chart.width * 0.7;
    const { ctx } = chart;
    ctx.save();
    ctx.font = o.fontPx ? `bold ${o.fontPx}px 'Pretendard', 'Malgun Gothic', sans-serif` : FIT_LABEL_FONT;
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = px(o.spacing ?? 0);
    let need = scale.max;
    chart.data.datasets.forEach((ds, di) => {
      if (!chart.isDatasetVisible(di)) return;
      const rates = (ds as { rates?: (number | null)[] }).rates;
      (ds.data as number[]).forEach((v, i) => {
        if (!(v > 0)) return;
        const rate = o.showRate ? rates?.[i] : null;
        const text = rate != null ? `${v}억 (${rate}%)` : `${v}억`;
        const room = w - ctx.measureText(text).width - 10;   // datalabels offset 4 + 여유
        if (room > 0) need = Math.max(need, scale.min + (v - scale.min) * w / room);
      });
    });
    ctx.restore();
    scale.max = need;
  },
};

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
// noHandle: 줄에 혼자라 순서를 바꿀 일이 없는 카드(파트별 인원, 2026-10-27)는 드래그 핸들을 안 그림
interface SortableChartProps { id: string; fullRow?: boolean; spanClassName?: string; dropState?: 'ok' | 'bad' | null; noHandle?: boolean; children: ReactNode; }
function SortableChart({ id, fullRow, spanClassName, dropState, noHandle, children }: SortableChartProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, transition: SORTABLE_TRANSITION });
  return (
    <div
      ref={setNodeRef}
      className={[fullRow ? styles.fullRow : '', spanClassName ?? '',
        dropState === 'ok' ? styles.dropOk : dropState === 'bad' ? styles.dropBad : ''].filter(Boolean).join(' ') || undefined}
      style={{
        // 끄는 동안 원래 카드는 제자리에 흐리게(자리 표시) — 실제로 움직이는 건 DragOverlay 미니 카드
        transform: CSS.Transform.toString(transform),
        transition: [transition, 'opacity 0.2s ease'].filter(Boolean).join(', '),
        opacity: isDragging ? 0.35 : 1,
        // 높이는 카드 클래스(.rowShort/.rowTall min-height) + 그리드 늘이기로 — 예전 height:100%·minHeight:0
        // (grid-auto-rows 고정일 때 쓰던 것)이 남아 있으면 그 min-height를 덮어써 차트가 납작해짐(2026-10-20)
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        position: 'relative',
        minHeight: CHART_TUNING[id]?.minHeight,   // 카드 높이 — chartTuning.ts의 minHeight(비우면 CSS 기본)
      }}
    >
      {/* 드래그는 몇 px 움직여야 시작(activationConstraint distance)이라 더블클릭과 안 겹침 */}
      {!noHandle && (
        <div className={styles.dragHandle} {...attributes} {...listeners}
          aria-label="차트 순서 이동" title="드래그하여 같은 줄 안에서 순서 변경">
          ⠿
        </div>
      )}
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
        const className = cardClass(id);
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

/** 차트 영역 안에 한 칸으로 들어가는 외부 카드 — 파트별 매출 진행 현황(PerformancePage가 막대·모달 연결을 들고 있어 내용만 받음) */
export interface AchievementCardProps {
  title: ReactNode;
  info?: ReactNode;
  /** 제목줄 오른쪽(titleCompact의 자식)에 놓을 범례 */
  legend?: ReactNode;
  body:  ReactNode;
}

const PerformanceChartSection = ({ achievement }: { achievement?: AchievementCardProps }) => {
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
      const merged = valid.length ? [...valid, ...added] : DEFAULT_CHART_ORDER;
      return isValidChartOrder(merged) ? merged : DEFAULT_CHART_ORDER;   // 줄이 깨지는 저장값은 버림
    } catch { return DEFAULT_CHART_ORDER; }
  });

  const dndSensors = useTableDndSensors();

  // 드롭 대상 판정 — 같은 줄 카드만 후보로 두고, 커서가 올라가 있는 카드를 우선(없으면 가장 가까운 중심).
  // 예전엔 전체 카드 중 '끄는 카드 중심'에 가장 가까운 것(closestCenter)이라, 3칸짜리 좁은 카드가 한 줄에 4개인 파트 줄에서는
  // 옆 카드로 끌어도 자기 자신이나 윗줄 카드가 잡혀 순서가 안 바뀌었음(2026-10-23)
  const rowCollision = useCallback<CollisionDetection>(args => {
    const activeId = String(args.active.id);
    const row = splitChartRows(chartOrder).find(r => r.includes(activeId)) ?? [activeId];
    const droppableContainers = args.droppableContainers.filter(c => row.includes(String(c.id)));
    const within = pointerWithin({ ...args, droppableContainers });
    return within.length ? within : closestCenter({ ...args, droppableContainers });
  }, [chartOrder]);

  // 드래그 중 놓을 자리 안내 — 놓을 수 있으면 파란 점선, 줄이 깨지는 자리면 빨간 점선(그 자리엔 놓아도 안 바뀜)
  const [dropTarget, setDropTarget] = useState<{ id: string; ok: boolean } | null>(null);
  const [activeChartId, setActiveChartId] = useState<string | null>(null);
  const handleChartDragStart = useCallback((e: DragStartEvent) => setActiveChartId(String(e.active.id)), []);
  const handleChartDragOver = useCallback((e: DragOverEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) { setDropTarget(null); return; }
    const next = arrayMove(chartOrder, chartOrder.indexOf(String(active.id)), chartOrder.indexOf(String(over.id)));
    setDropTarget({ id: String(over.id), ok: isValidChartOrder(next) });
  }, [chartOrder]);
  const handleChartDragEnd = useCallback((e: DragEndEvent) => {
    setDropTarget(null);
    setActiveChartId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setChartOrder(prev => {
      const next = arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id)));
      if (!isValidChartOrder(next)) return prev;   // 줄이 깨지는 자리 — 그대로 둠
      localStorage.setItem(LS_CHART_ORDER, JSON.stringify(next));
      return next;
    });
  }, []);

  const palette = useChartPalette();
  const isAdmin = useUiStore(s => s.adminAuthed);   // 인당 차트 빈 상태 안내 문구가 관리자에게만 입력 위치를 알려줌

  // "계획" 막대 — 중립색(실적/원가 계열과 겹치지 않게). KPI "26년 목표" 막대와 같은 값
  const planColor = palette.plan;

  // 이익율/이익액 토글 비활성화로 미사용(주석 처리) — 복구 시 함께 해제
  // const profitColors = useMemo(() => vm.profitRate.isProfit.map(ok =>
  //   ok ? palette.rate : palette.loss
  // ), [vm.profitRate.isProfit, palette]);

  const doughnutColors = useMemo(
    // 직접원가·인건비·공통원가(파랑 3톤) + 관리비(Gold) + 경상손익(기본 Red — ⚙ 차트 색상에서 따로 고름, 2026-10-19)
    () => [palette.costDirect, palette.costLabor, palette.costOverhead, palette.costMgmt, palette.costProfit],
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
    // 세로 막대라 수치가 막대 '위'에 찍힘 — makeBarOptions 최소 여백의 right 58(가로 막대 수치용)은 여기선
    // 오른쪽만 텅 비게 해서 덮어씀. 막대도 기본(0.8×0.9)보다 굵게 해 양옆 빈 공간을 줄임(2026-10-20)
    // ★ 여백·막대 굵기·글자 크기·자간 값은 chartTuning.ts의 CHART_TUNING.monthly 에서 고친다(2026-10-27 이동)
    layout: { padding: CHART_TUNING.monthly.padding },
    datasets: tuningBarSize(CHART_TUNING.monthly),
    // 원가 막대 위 원가율 "(54.8%)"(costRatePlugin, 2026-10-21 요청) — 막대가 글자보다 좁으면 생략
    // 막대 위 수치(억·원가율)는 이 차트만 글자 1px 작게(14→13, 12→11) + 자간 좁게(tightLabelsPlugin) — 2026-10-23 요청
    plugins: {
      ...vm.monthly.options.plugins,
      datalabels: {
        ...vm.monthly.options.plugins?.datalabels,
        font: tuningLabelFont(CHART_TUNING.monthly),
        textAlign: 'center' as const,
        // 원가 막대(데이터셋 1) 수치 아래 줄에 원가율 — 같은 글자색(INLINE_COST_RATE)
        formatter: (v: number, ctx: { chart: Chart; datasetIndex: number; dataIndex: number }) => {
          const t = `${v}억`;
          const r = INLINE_COST_RATE && ctx.datasetIndex === 1 ? costRateText(ctx.chart, ctx.dataIndex) : null;
          return r ? [t, r] : t;
        },
      },
      costRate: { show: vm.showLabels && !INLINE_COST_RATE, text: dark ? 'rgb(0,170,210)' : 'rgb(0,119,147)', ...costRateTuning(CHART_TUNING.monthly) },
      tightLabels: { spacing: px(CHART_TUNING.monthly.labelSpacing) },
      tightTicks: { spacing: px(CHART_TUNING.monthly.tickSpacing), axes: ['x'] as ('x' | 'y')[] },   // 세로 막대 — 아래 월 글자 자간
    },
    scales: {
      x: { ...scaleOverride.x, ticks: { ...scaleOverride.x.ticks, ...tuningTickFont(CHART_TUNING.monthly) } },
      y: { ...scaleOverride.y, ticks: { ...scaleOverride.y.ticks, ...tuningTickFont(CHART_TUNING.monthly), callback: (v: string | number) => v + '억' } },
    },
  }), [vm.monthly.options, scaleOverride, vm.showLabels, dark]);

  // 수치 글자색 = 그 막대 색(계획 회색 / 추정 실적 남색) — 공통 labelColor(남색)였을 땐 두 수치가
  // 같은 색이라 어느 막대 값인지 헷갈림(2026-09-29). 단 계획은 막대색(반투명 plan)이 글자로는 흐려서
  // 불투명·진한 palette.planLabel — 막대색은 계획 통일색 그대로
  const planVsActualOptions = useMemo(() => {
    const base = withUnstackedTheme(vm.planVsActual.options, scaleOverride);
    return {
      ...base,
      // 수치 자리는 여백 대신 축 끝을 막대별로 딱 맞게 늘려서(fitBarLabelsPlugin) — 오른쪽 여백은 최소
      // ★ 여백·막대 굵기·글자 크기·자간 값은 chartTuning.ts의 CHART_TUNING.planVsActual 에서 고친다(2026-10-27)
      layout: { padding: CHART_TUNING.planVsActual.padding },
      datasets: tuningBarSize(CHART_TUNING.planVsActual),
      scales: {
        ...base.scales,
        x: { ...base.scales?.x, grace: 0, ticks: { ...(base.scales?.x as { ticks?: object } | undefined)?.ticks, ...tuningTickFont(CHART_TUNING.planVsActual) } },
        y: { ...base.scales?.y, ticks: { ...(base.scales?.y as { ticks?: object } | undefined)?.ticks, ...tuningTickFont(CHART_TUNING.planVsActual),
          ...(CHART_TUNING.planVsActual.breakTickAtDot ? { callback: breakAtDotTick } : {}) } },
      },
      plugins: {
        ...base.plugins,
        fitBarLabels: { show: vm.showLabels, showRate: vm.planVsActual.showRate, fontPx: CHART_TUNING.planVsActual.labelFontPx, spacing: CHART_TUNING.planVsActual.labelSpacing },
        tightLabels: { spacing: px(CHART_TUNING.planVsActual.labelSpacing) },
        tightTicks: { spacing: px(CHART_TUNING.planVsActual.tickSpacing), axes: ['y'] as ('x' | 'y')[] },
        datalabels: {
          ...base.plugins?.datalabels,
          font: tuningLabelFont(CHART_TUNING.planVsActual),
          color: (ctx: { datasetIndex: number; dataset: { backgroundColor?: unknown }; dataIndex: number }) => {
            if (ctx.datasetIndex === 0) return palette.planLabel;
            const bg = ctx.dataset.backgroundColor;
            return (Array.isArray(bg) ? bg[ctx.dataIndex] : bg) as string;
          },
        },
      },
    };
  }, [vm.planVsActual.options, scaleOverride, palette.planLabel, vm.showLabels, vm.planVsActual.showRate]);

  // 파트별 인당 차트 3개 옵션(2026-10-23) — 가로 막대, 축 '억', 툴팁에 그 파트 인원. 차트마다 따로 조절(2026-10-27):
  // ★ 여백·막대 굵기·글자 크기·자간 값은 chartTuning.ts의 CHART_TUNING.perCapitaRevenue / perCapitaProfit / perCapitaMgmt 에서 고친다
  const perCapitaChartOptions = useMemo(() => {
    const build = (id: 'perCapitaRevenue' | 'perCapitaProfit' | 'perCapitaMgmt', values: number[]): ChartOptions<'bar'> => {
      const t = CHART_TUNING[id];
      const base = withUnstackedTheme(vm.perCapita.options, scaleOverride);
      const xScale = base.scales?.x as { ticks?: object } | undefined;
      const yScale = base.scales?.y as { ticks?: object } | undefined;
      // 계획 vs 추정 실적 차트와 같은 방식(2026-10-23 "캔버스 가로폭 늘려줘") — 수치 자리를 고정 여백이 아니라 축 끝을
      // 막대별로 딱 맞게 늘려서(fitBarLabelsPlugin) 오른쪽 여백은 최소. 왼쪽은 마이너스 막대가 그 차트에 있을 때만(leftIfNegative) 수치 자리 확보
      const hasNegative = values.some(v => v < 0);
      return {
        ...base,
        layout: { padding: { ...t.padding, left: hasNegative && t.leftIfNegative != null ? t.leftIfNegative : t.padding.left } },
        datasets: tuningBarSize(t),
        scales: {
          ...base.scales,
          x: { ...xScale, grace: 0, ticks: { ...xScale?.ticks, ...tuningTickFont(t), callback: (v: string | number) => v + '억' } },
          y: { ...yScale, ticks: { ...yScale?.ticks, ...tuningTickFont(t), ...(t.breakTickAtDot ? { callback: breakAtDotTick } : {}) } },
        },
        plugins: {
          ...base.plugins,
          fitBarLabels: { show: vm.showLabels, showRate: false, fontPx: t.labelFontPx, spacing: t.labelSpacing },
          tightLabels: { spacing: px(t.labelSpacing) },
          tightTicks: { spacing: px(t.tickSpacing), axes: ['y'] },
          datalabels: { ...base.plugins?.datalabels, font: tuningLabelFont(t) },
          tooltip: { callbacks: {
            afterLabel: (ctx: { dataIndex: number }) =>
              // `인원 계획 ${vm.perCapita.planHeadcounts[ctx.dataIndex] ?? '-'}명 · 현재 ${vm.perCapita.headcounts[ctx.dataIndex] ?? '-'}명`,   // 계획 인원 주석 처리(2026-10-27)
              `현재 인원 ${formatHeadcount(vm.perCapita.headcounts[ctx.dataIndex])}명`,
          } },
        },
      } as ChartOptions<'bar'>;
    };
    return {
      perCapitaRevenue: build('perCapitaRevenue', vm.perCapita.revEst),
      perCapitaProfit:  build('perCapitaProfit',  vm.perCapita.profit),
      perCapitaMgmt:    build('perCapitaMgmt',    vm.perCapita.mgmt),
    };
  }, [vm.perCapita.options, vm.perCapita.headcounts, vm.perCapita.revEst, vm.perCapita.profit, vm.perCapita.mgmt, vm.showLabels, scaleOverride]);

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
  const partRevCostOptions = useMemo(() => {
   const base = withUnstackedTheme(makeBarOptions(vm.showLabels, labelColor, {
      // ★ 여백·막대 굵기·글자 크기·자간·원가율 위치 값은 chartTuning.ts의 CHART_TUNING.profitRate 에서 고친다(2026-10-27)
      layout: { padding: CHART_TUNING.profitRate.padding },
      plugins: {
        datalabels: {
          // makeBarOptions 기본(13px)보다 살짝만 작게 — 이전엔 10px로 너무 작게 오버라이드돼
          // 있었고, 기본값 그대로 쓰니 이 차트(파트 수 많고 막대 2개씩)에서는 조금 커서 재조정
          anchor: 'end',
          // 원가 수치만 오른쪽으로 COST_LABEL_SHIFT px(위 costLabelAlign) — 메인 카드만, 확대 모달은 'end'로 되돌림
          align: costLabelAlign,
          offset: REV_COST_LABEL_OFFSET,
          font: tuningLabelFont(CHART_TUNING.profitRate),
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
    }), scaleOverride);
   return {
    ...base,
    datasets: tuningBarSize(CHART_TUNING.profitRate),
    // 매출·원가 막대 사이 원가율 칩(costRatePlugin) — makeBarOptions는 legend·datalabels 외 플러그인 옵션을 버려서 여기서 덧붙임
    plugins: {
      ...base.plugins,
      costRate: { show: vm.showLabels && !INLINE_COST_RATE, text: dark ? 'rgb(0,170,210)' : 'rgb(0,119,147)', ...costRateTuning(CHART_TUNING.profitRate) },
      tightLabels: {
        spacing: px(CHART_TUNING.profitRate.labelSpacing),
        // 막대 안쪽 흰색 수치만 따로 — chartTuning.ts profitRate.innerLabelSpacing
        ...(CHART_TUNING.profitRate.innerLabelSpacing != null ? { whiteSpacing: px(CHART_TUNING.profitRate.innerLabelSpacing) } : {}),
      },
      tightTicks: { spacing: px(CHART_TUNING.profitRate.tickSpacing), axes: ['x'] as ('x' | 'y')[] },   // 세로 막대 — 아래 파트명 자간   // 이 차트만 2px 낮게(2026-10-21 요청). 합계 수치(labelColor)와 다른 색 — Active Blue(라이트는 검정 30% 섞어 진하게). 공통원가 회청색은 너무 연했음
      // 원가 층은 보기용 높이라 툴팁도 실제값(realData)으로
      tooltip: { callbacks: { label: (ctx: { dataIndex: number; dataset: unknown }) =>
        `${(ctx.dataset as { label?: string }).label}: ${realValue(ctx)}억` } },
    },
    scales: {
      // x축 파트명 — 다크 모드에선 흰색(공통 tickColor Sand가 어두운 배경에서 흐려 보임), 라이트는 공통값 유지
      // 원가 막대 = 직접원가(아래) + 공통원가(위) 2층(2026-10-20) — 데이터셋 stack으로 매출 막대와 나란히, 원가끼리만 쌓음
      x: { ...scaleOverride.x, stacked: true, offset: true, ticks: { ...scaleOverride.x.ticks, ...tuningTickFont(CHART_TUNING.profitRate), align: 'center' as const, color: dark ? '#FFFFFF' : tickColor,
        padding: 3 } },
      // 위 여유(grace) 15% → 8% — 막대 위 수치 자리는 layout padding top 36이 따로 잡고 있어 위가 많이 비었음(2026-10-20)
      y: { ...scaleOverride.y, grace: '8%', stacked: true, ticks: { ...scaleOverride.y.ticks, ...tuningTickFont(CHART_TUNING.profitRate), callback: (v: string | number) => v + '억' } },
    },
   };
  }, [vm.showLabels, labelColor, scaleOverride, dark, tickColor]);

  // "파트별 추정 매출/원가" 확대 모달 전용 — 차트 밑에 원본 수치 표를 같이 보여줘서
  // 막대를 하나씩 클릭하지 않아도 전체 파트를 한 번에 검증할 수 있게 함 (2026-09-15 시범)
  const partRevCostRows = useMemo(
    () => vm.profitRate.labels.map((part, i) => {
      const revenue = vm.profitRate.revenues[i];
      const cost    = vm.profitRate.costs[i];
      return {
        part, revenue, cost, overhead: vm.profitRate.overheads[i] ?? 0,
        costRate: revenue > 0 ? +(cost / revenue * 100).toFixed(1) : null,
        profit:   +(revenue - cost).toFixed(1),
      };
    }),
    [vm.profitRate.labels, vm.profitRate.revenues, vm.profitRate.costs, vm.profitRate.overheads],
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

  // 인당 차트 카드 공통 틀 — 인원이 하나도 없으면 안내, 일부만 없으면 제목 옆에 빠진 파트 수
  const perCapitaCard = (id: string, info: ReactNode, datasets: { label: string; data: (number | null)[]; backgroundColor: string | string[] }[]) => {
    const { labels, missingParts, partialParts } = vm.perCapita;
    const skipped = [...missingParts, ...partialParts];
    const skippedTip = [
      missingParts.length ? `인원 미입력: ${missingParts.join(', ')}` : '',
      partialParts.length ? `팀 필터로 인당 값을 못 구함: ${partialParts.join(', ')}` : '',
    ].filter(Boolean).join(' / ');
    return (
      <ChartCard expandable={false} bodyBleedX={CHART_TUNING[id]?.bleedX}>
        <ChartCard.Title>
          <span className={styles.chartTitle}>{CHART_TITLES[id]}<InfoButton>{info}</InfoButton></span>
          {skipped.length > 0 && labels.length > 0 && (
            <span className={styles.titleNote} title={skippedTip}>{skipped.length}개 파트 제외</span>
          )}
        </ChartCard.Title>
        <ChartCard.Body>
          {labels.length === 0
            ? <div className={styles.perCapitaEmpty}>
                {partialParts.length > 0 && missingParts.length === 0
                  ? '팀 필터 중에는 여러 팀에 걸친 파트의 인당 값을 구할 수 없습니다'
                  : isAdmin
                    ? '파트 인원이 아직 입력되지 않았습니다 — 관리자 페이지 > 파트별 인원에서 입력하세요'
                    : '파트 인원이 아직 입력되지 않았습니다'}
              </div>
            : <BarChart horizontal labels={labels} datasets={datasets} options={perCapitaChartOptions[id as keyof typeof perCapitaChartOptions]} plugins={[fitBarLabelsPlugin, tightTicksPlugin, tightLabelsPlugin]} />}
        </ChartCard.Body>
      </ChartCard>
    );
  };

  const chartRenderers: Record<string, () => ReactNode | null> = {
    // 파트별 인원 — 관리자가 입력한 현재 인원(인당 차트의 분모), 왼쪽 정렬. 계획 인원 줄은 2026-10-27 주석 처리.
    // 팀 필터와 무관하게 파트 전체 인원. 하나도 없으면 안내
    headcount: () => {
      const hc = vm.headcount;
      // [계획/현재 두 줄 구조 — 주석 처리 2026-10-27] 계획 인원이 빠져 줄이 하나라 줄 묶음·반복문·고정 폭 라벨을 걷어냄.
      // 복구하려면 아래 한 줄 구조 대신 이 블록을 쓰고 vm.headcount의 plan/totalPlan, CSS .headcountRows/.headcountRow도 같이 해제
      // const rows = [
      //   { key: 'plan', label: '파트별 계획 인원', values: hc.plan, total: hc.totalPlan },
      //   { key: 'cur', label: '파트별 현재 인원', values: hc.current, total: hc.totalCurrent },
      // ];
      // ... <div className={styles.headcountRows}>{rows.map(r => (<div key={r.key} className={styles.headcountRow}>
      //       <span className={styles.headcountRowLabel}>{r.label}</span><ul className={styles.headcountList}>…파트 알약 + 합계…</ul></div>))}</div>
      return (
        <ChartCard expandable={false} dense>
          {/* 카드 제목 없음(2026-10-23 요청) — 목록 앞 라벨(파트별 인원)이 제목 역할. dense = 빈 제목줄·큰 여백 제거(높이 축소, 2026-10-27) */}
          <ChartCard.Title>{null}</ChartCard.Title>
          <ChartCard.Body>
            {hc.labels.length === 0
              ? <div className={styles.perCapitaEmpty}>
                  {isAdmin
                    ? '파트 인원이 아직 입력되지 않았습니다 — 관리자 페이지 > 파트별 인원에서 입력하세요'
                    : '파트 인원이 아직 입력되지 않았습니다'}
                </div>
              : <div className={styles.headcountRow}>
                  <span className={styles.headcountRowLabel}>파트별 인원</span>
                  <ul className={styles.headcountList}>
                    {hc.labels.map((name, i) => (
                      <li key={name} className={styles.headcountItem}>
                        <span className={styles.headcountName}>{name}</span>
                        <span className={styles.headcountSep}>:</span>
                        <b className={styles.headcountVal}>{formatHeadcount(hc.current[i])}명</b>
                      </li>
                    ))}
                    <li className={`${styles.headcountItem} ${styles.headcountTotal}`}
                      title={hc.missingParts.length > 0 ? `인원 미입력 파트: ${hc.missingParts.join(', ')}` : undefined}>
                      <span className={styles.headcountName}>합계</span>
                      <span className={styles.headcountSep}>:</span>
                      <b className={styles.headcountVal}>{formatHeadcount(hc.totalCurrent)}명</b>
                    </li>
                  </ul>
                </div>}
          </ChartCard.Body>
        </ChartCard>
      );
    },
    // 파트별 매출 진행 현황 — 데이터가 아직 없으면 카드 없음. 투어 앵커(perf-achievement)는 이 래퍼에(예전엔 페이지 섹션에 있었음)
    achievement: () => achievement ? (
      <div data-tour="perf-achievement" className={styles.fillCard}>
        <ChartCard expandable={false} titleAside={achievement.legend}>
          <ChartCard.Title>
            <span className={styles.chartTitle}>{achievement.title}{achievement.info && <InfoButton>{achievement.info}</InfoButton>}</span>
          </ChartCard.Title>
          <ChartCard.Body>{achievement.body}</ChartCard.Body>
        </ChartCard>
      </div>
    ) : null,
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
          plugins={[costRatePlugin, tightLabelsPlugin, tightTicksPlugin]}
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
          <ChartCard.Title>
            <span className={styles.chartTitle}>진도율(월별 실적 추이)<InfoButton>{INFO_MONTHLY}</InfoButton></span>
            {/* 매출/원가 추정 누계 실적 + 진행률(누계 ÷ 연간 추정) — 제목 바로 옆(2026-10-23 요청, 예전 KPI 카드 자리) */}
            {vm.monthly.cumulative && (
              <span className={styles.cumNote}>
                <span className={styles.cumLabel}>{vm.monthly.cumulative.label}</span>
                <span className={styles.cumItem} style={{ '--cum-color': palette.revenue } as CSSProperties}>매출 <b>{vm.monthly.cumulative.revenue}</b>{vm.monthly.cumulative.revenueRate && <i>(진행률 {vm.monthly.cumulative.revenueRate})</i>}</span>
                <span className={styles.cumItem} style={{ '--cum-color': palette.cost } as CSSProperties}>원가 <b>{vm.monthly.cumulative.cost}</b>{vm.monthly.cumulative.costRate && <i>(진행률 {vm.monthly.cumulative.costRate})</i>}</span>
              </span>
            )}
            {/* 원가 막대 위 %가 뭔지(2026-10-21) — 그래프 수치 켬일 때만(%가 보일 때) */}
            {vm.showLabels && <span className={styles.titleNote}><b className={styles.titleNotePct}>%</b>원가율 = 원가 ÷ 매출</span>}
          </ChartCard.Title>
          <ChartCard.Body>{chartEl}</ChartCard.Body>
        </ChartCard>
      );
    },
    // 파트별 인당 매출·손익·관리비(2026-10-23) — 인원은 관리자 수기 입력(백엔드가 나눠서 내려줌). 인당 계획 매출은 2026-10-27 주석 처리(추정만)
    perCapitaRevenue: () => perCapitaCard('perCapitaRevenue', infoPerCapita('revenue'), [
      // { label: '계획(억)', data: vm.perCapita.revPlan, backgroundColor: planColor },   // 인당 계획 매출 막대 주석 처리(2026-10-27) — 계획 인원이 없어 분모 없음
      { label: '추정 매출(억)', data: vm.perCapita.revEst, backgroundColor: palette.revenue },
    ]),
    perCapitaProfit: () => perCapitaCard('perCapitaProfit', infoPerCapita('profit'), [
      { label: '추정 경상손익(억)', data: vm.perCapita.profit,
        // 경상손익 색(도넛의 costProfit — 기본 빨강)으로 통일(2026-10-27 요청). 예전: 플러스 palette.profit(파랑) / 마이너스 palette.loss(빨강)
        // backgroundColor: vm.perCapita.isProfit.map(ok => (ok ? palette.profit : palette.loss)) },
        backgroundColor: vm.perCapita.isProfit.map(() => palette.costProfit) },
    ]),
    perCapitaMgmt: () => perCapitaCard('perCapitaMgmt', infoPerCapita('mgmt'), [
      { label: '추정 관리비(억)', data: vm.perCapita.mgmt, backgroundColor: palette.costMgmt },
    ]),
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
              // rates = 막대 끝 달성률(%) — ChartDataset 타입에 없는 사용자 필드라 단언(datalabels formatter가 읽음)
              { label: '추정 실적(억)', data: pick(vm.planVsActual.junCheckTotal), backgroundColor: palette.revenue,
                rates: pick(vm.planVsActual.rates) } as ChartDataset<'bar'>,
            ]}
            options={planVsActualOptions}
            plugins={[fitBarLabelsPlugin, tightTicksPlugin, tightLabelsPlugin]}
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
        <ChartCard modalContent={modalContent} bodyBleedX={CHART_TUNING.planVsActual.bleedX}>
          <ChartCard.Title>
            <span className={styles.chartTitle}>파트별 계획 매출 vs 추정 매출<InfoButton>{INFO_PLAN_VS_ACTUAL}</InfoButton></span>
            {/* 막대 수치의 %가 뭔지 — 항상 표시(2026-10-21 요청, 예전엔 그래프 수치 + 달성률 공개 범위일 때만) */}
            {(
              <span className={styles.titleNote}><b className={styles.titleNotePct}>%</b>계획 대비 달성률 = 추정 실적 ÷ 계획</span>
            )}
          </ChartCard.Title>
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
      // 원가는 2층 — 아래 직접원가(원가행 BH) · 위 공통원가(매출행 BD). 각 층 안에 그 층 값, 맨 위에 두 층 합(2026-10-20 요청).
      // 층 안 수치는 흰 글자(층이 낮아 글자가 안 들어가면 생략), 합계는 원가색 글자로 막대 위
      const directs   = pick(vm.profitRate.costs);
      const overheads = pick(vm.profitRate.overheads);
      const baseDatasets = [
        { label: '매출', data: pick(vm.profitRate.revenues), backgroundColor: palette.revenue, stack: 'rev' },
        { label: '직접원가', data: directs, realData: directs, backgroundColor: visibleCostColors, stack: 'cost',
          datalabels: SEGMENT_LABEL },
        { label: '공통원가', data: overheads, realData: overheads, backgroundColor: palette.costOverhead, stack: 'cost',
          datalabels: {
            labels: {
              value: SEGMENT_LABEL,
              side: SIDE_LABEL,
              total: {
                display: vm.showLabels,
                anchor: 'end' as const, align: 'end' as const,
                color: palette.cost,
                textAlign: 'center' as const,
                // 합계 아래 줄에 원가율(원가(직접+공통) ÷ 매출) — 같은 글자색(INLINE_COST_RATE)
                formatter: (_: number, ctx: { chart: Chart; dataIndex: number }) => {
                  const t = `${+((directs[ctx.dataIndex] ?? 0) + (overheads[ctx.dataIndex] ?? 0)).toFixed(1)}억`;
                  const r = INLINE_COST_RATE ? costRateText(ctx.chart, ctx.dataIndex) : null;
                  return r ? [t, r] : t;
                },
              },
            },
          } },
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
          plugins={[costRatePlugin, layerBoostPlugin, tightLabelsPlugin, tightTicksPlugin]}
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
          plugins={[planLinePlugin, costRatePlugin, layerBoostPlugin, tightLabelsPlugin, tightTicksPlugin]}
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
            <span className={styles.chartTitle}>원가분석(파트별 추정 매출/원가)<InfoButton>{INFO_PROFIT_RATE}</InfoButton></span>
            {/* 막대 발치 칩의 %가 뭔지 — 칩이 보일 때(그래프 수치)만 */}
            {vm.showLabels && (
              <span className={styles.titleNote}><b className={styles.titleNotePct}>%</b>원가율 = 원가(직접+공통) ÷ 매출</span>
            )}
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
    // 전체 평균 원가 비율 — 관리자 로그인한 사람만(2026-10-06, 서버도 원가 구성 값을 안 줌)
    costBreakdown: () => (
      <ChartCard
        modalContent={
          <CostBreakdownModal
            total={vm.chartData?.costBreakdownTotal ?? { labels: [], values: [] }}
            byPart={vm.chartData?.costBreakdownByPart ?? {}}
            byTeam={vm.chartData?.costBreakdownByTeam}
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
            differs={vm.costFilterDiffers}
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
          spanClassName={cardClass(c.id)}
          noHandle={c.id === 'headcount'}
          dropState={dropTarget?.id === c.id ? (dropTarget.ok ? 'ok' : 'bad') : null}
        >
          {c.node}
        </SortableChart>
      ));

  return (
    <>
      <DndContext sensors={dndSensors} collisionDetection={rowCollision}
        onDragStart={handleChartDragStart} onDragOver={handleChartDragOver} onDragEnd={handleChartDragEnd}
        onDragCancel={() => { setDropTarget(null); setActiveChartId(null); }}
        // 가로 자동 스크롤 끔 — 오른쪽으로 끌면 무한 가로 스크롤 되던 것. 미니 카드(DragOverlay)는 position:fixed라
        // 페이지 폭을 늘리지 않아 예전의 화면 밖 막기(modifier)는 필요 없음
        autoScroll={{ threshold: { x: 0, y: 0.2 } }}>
        {/* 끄는 동안 다른 카드는 제자리(미리 밀려나는 미리보기 없음) — 카드 크기가 달라(8칸·4칸) 미리보기가 카드를
            늘리고 찌그러뜨리며 화면 밖으로 밀었음. 놓을 자리는 점선 테두리로 안내, 놓는 순간 순서 바뀜(2026-10-20) */}
        <SortableContext items={visibleCharts.map(c => c.id)} strategy={staticPreview}>
          <div className={styles.grid} key={`${dark ? 'dark' : 'light'}-${chartState}`}>
            {content}
          </div>
        </SortableContext>
        {/* body로 포털(2026-10-27) — 페이지 래퍼(.fadeUp)의 transform 때문에 position:fixed가 화면이 아니라 그 래퍼 기준이 돼,
            스크롤을 내린 상태(아래쪽 파트별 차트 줄)에서 끄면 미니 카드가 화면 위 밖에 그려져 "뭐가 옮겨지는지" 안 보였음 */}
        {createPortal(
          <DragOverlay dropAnimation={prefersReducedMotion() ? null : OVERLAY_DROP_ANIMATION}>
            {activeChartId ? (
              <div className={styles.dragGhost}>
                <span className={styles.dragGhostGrip}>⠿</span>
                {CHART_TITLES[activeChartId] ?? activeChartId}
              </div>
            ) : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>

      {breakdown && (
        <PerfBreakdownModal target={breakdown} onClose={() => setBreakdown(null)} />
      )}
    </>
  );
};

export default PerformanceChartSection;
