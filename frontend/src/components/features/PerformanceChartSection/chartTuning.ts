// 실적 탭 차트 6개의 "디테일 조절표"(2026-10-27) — 여백·막대 굵기·수치 글자 크기/자간·축 글자·카드 높이를 여기 한곳에서 고친다.
// 값을 바꾸고 저장하면 개발 서버(5188)에 바로 반영. 처음 값은 그 전 화면과 똑같이 맞춰둔 것(바꾸기 전 모습).
//
//   monthly          진도율(월별 실적 추이)
//   profitRate       원가분석(파트별 추정 매출/원가)
//   planVsActual     파트별 계획 매출 vs 추정 매출
//   perCapitaRevenue 파트별 인당 매출
//   perCapitaProfit  파트별 인당 손익
//   perCapitaMgmt    파트별 인당 관리비
//
// 이 표를 읽어 Chart.js 옵션으로 바꾸는 곳은 PerformanceChartSection.tsx의 각 차트 옵션 함수
// (monthlyOptions · partRevCostOptions · planVsActualOptions · perCapitaChartOptions). 코드는 안 건드려도 됨.
import type { ChartOptions } from 'chart.js';

export interface ChartTuning {
  /** 캔버스 안쪽 여백(px) — 카드 테두리 안쪽에서 그래프까지. 막대 위·옆에 찍히는 수치가 잘리지 않을 만큼은 남길 것
   *  (막대 위에 수치가 찍히는 세로 막대는 top, 막대 옆에 찍히는 가로 막대는 right). 카드 자체 안쪽 여백(20/24/16)은 별도 */
  padding: { top: number; right: number; bottom: number; left: number };
  /** 마이너스 막대가 있을 때만 쓰는 왼쪽 여백(px) — 막대 왼쪽에 수치 자리 확보(인당 손익). 없으면 padding.left */
  leftIfNegative?: number;
  /** 막대 굵기 — categoryPercentage: 카테고리 한 칸 중 막대 묶음이 차지하는 비율(0~1, 클수록 칸 사이 간격이 좁아짐),
   *  barPercentage: 묶음 안에서 막대 한 개가 차지하는 비율(0~1, 클수록 매출·원가 막대 사이 간격이 좁아짐). 비우면 Chart.js 기본(0.8 / 0.9) */
  categoryPercentage?: number;
  barPercentage?: number;
  /** 막대 위·옆 수치(억) 글자 크기(px) */
  labelFontPx: number;
  /** 막대 수치 글자 자간(px) — 음수일수록 촘촘. 0 = 기본 */
  labelSpacing: number;
  /** 축 눈금(파트명·억 눈금) 글자 크기(px) — 비우면 전체 기본(14) */
  tickFontPx?: number;
  /** 파트명 축 눈금 자간(px) — 음수일수록 촘촘. 0 = 기본. 가로 막대는 왼쪽 파트명, 세로 막대는 아래 파트명 */
  tickSpacing: number;
  /** 카드 최소 높이(px) — 비우면 CSS 기본(진도율·인당·계획 vs 추정 430 / 원가분석 540). 안의 그래프도 그만큼 커짐 */
  minHeight?: number;
  /** 막대 위 원가율 "(54.8%)" — 월별·원가분석만. lift: 원가 막대 꼭대기에서 위로 띄우는 px, fontPx: 글자 크기,
   *  minBarWidth: 막대가 이보다 좁으면 안 그림 */
  costRate?: { lift: number; fontPx: number; minBarWidth?: number };
}

export const CHART_TUNING: Record<string, ChartTuning> = {
  monthly: {
    padding: { top: 6, right: 1, bottom: 1, left: 1 },
    categoryPercentage: 0.92,
    barPercentage: 0.92,
    labelFontPx: 13,
    labelSpacing: -0.3,
    tickSpacing: 0,
    costRate: { lift: 41, fontPx: 11, minBarWidth: 30 },
  },
  profitRate: {
    padding: { top: 20, right: 12, bottom: 12, left: 4 },
    labelFontPx: 12,
    labelSpacing: 0,
    tickSpacing: 0,
    costRate: { lift: 39, fontPx: 12 },
  },
  planVsActual: {
    padding: { top: 30, right: 0, bottom: 4, left: 4 },
    labelFontPx: 14,
    labelSpacing: 0,
    tickSpacing: -1,
  },
  perCapitaRevenue: {
    padding: { top: 30, right: 0, bottom: 4, left: 4 },
    labelFontPx: 14,
    labelSpacing: 0,
    tickSpacing: -1,
  },
  perCapitaProfit: {
    padding: { top: 30, right: 0, bottom: 4, left: 4 },
    leftIfNegative: 48,
    labelFontPx: 14,
    labelSpacing: 0,
    tickSpacing: -1,
  },
  perCapitaMgmt: {
    padding: { top: 30, right: 0, bottom: 4, left: 4 },
    labelFontPx: 14,
    labelSpacing: 0,
    tickSpacing: -1,
  },
};

const LABEL_FAMILY = "'Pretendard', 'Malgun Gothic', sans-serif";

/** 막대 수치(datalabels) 글꼴 */
export const tuningLabelFont = (t: ChartTuning) => ({ size: t.labelFontPx, weight: 'bold' as const, family: LABEL_FAMILY });

/** 막대 굵기(options.datasets.bar) — 값이 있는 것만 넣음(비우면 Chart.js 기본) */
export const tuningBarSize = (t: ChartTuning) => ({
  bar: {
    ...(t.categoryPercentage != null ? { categoryPercentage: t.categoryPercentage } : {}),
    ...(t.barPercentage != null ? { barPercentage: t.barPercentage } : {}),
  },
}) as ChartOptions<'bar'>['datasets'];

/** 축 눈금 글자 크기(비우면 {} — 기본 유지) */
export const tuningTickFont = (t: ChartTuning) => (t.tickFontPx != null ? { font: { size: t.tickFontPx } } : {});

/** 자간 px → canvas letterSpacing 문자열 */
export const px = (n: number) => `${n}px`;
