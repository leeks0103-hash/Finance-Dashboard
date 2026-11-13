import type { Plugin } from 'chart.js';
import { getDatalabelAlpha } from '@/utils/datalabelFade';

/**
 * 진도율(월별 실적 추이)의 원가율을 막대 위 "(54.8%)" 대신 **차트 위쪽 띠의 꺾은선**으로 그린다(2026-11-11, 대표님 요청 + 시안 3번).
 *
 * 왜: 막대 위에 따로 뜬 %가 어느 막대 값인지 흐릿했고, 막대 안·아래에 넣는 방식은 값이 비슷하거나 막대가 작으면 수치 자리가 애매했음.
 * 띠는 막대 크기와 무관한 자기 자리라 어떤 값에서도 겹치지 않고, 오르내림(추이)도 보임.
 *
 * ⚠️ 되돌리기: PerformanceChartSection.tsx의 `COST_RATE_STYLE`을 'floating'으로 — 예전 costRatePlugin 방식이 그대로 나옴(이 파일은 안 쓰임).
 * 이 플러그인은 데이터셋·축을 건드리지 않고 위쪽 여백(RATE_BAND_PAD_TOP)에 직접 그린다 — 막대 클릭·범례·확대 모달 표에 영향 없음.
 */

/** 위쪽 여백 높이(px) — 캡션·꺾은선·수치 글씨가 들어갈 띠. 이 값만큼 막대 영역이 줄어듦 */
export const RATE_BAND_PAD_TOP = 60;
/** 띠 안에서 꺾은선이 오르내리는 세로 구간(px, 캔버스 위에서부터) */
const BAND_TOP = 26;
const BAND_BOTTOM = 46;
/** 띠의 최소 세로 폭(%p) — 값이 거의 같을 때 작은 차이가 요동처럼 과장되지 않게(예: 55.0~55.7%는 일자선 그대로) */
const MIN_SPAN = 8;
const FONT_FAMILY = "'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";
const FUTURE_ALPHA = 0.45;

/** 월별 원가율(%, 소수 첫째 자리) — 원가 ÷ 매출. 매출이나 원가가 0 이하라 못 구하면 null(선이 끊기고 "–"로 표시).
 *  기존 막대 위 원가율(costRatePlugin)과 같은 값(차트에 보이는 억 단위 매출·원가로 계산)이라 방식을 바꿔도 숫자가 같음 */
export const monthlyCostRates = (revenues: number[], costs: number[]): (number | null)[] =>
  revenues.map((rev, i) => {
    const cost = costs[i];
    return rev > 0 && cost > 0 ? Math.round((cost / rev) * 1000) / 10 : null;
  });

export interface RateBand { lo: number; span: number }

/** 띠가 보여 줄 값 범위 — 실제 최소~최대에 맞추되 최소 MIN_SPAN(%p). 값이 하나도 없으면 null */
export const rateBand = (rates: (number | null)[]): RateBand | null => {
  const vals = rates.filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(max - min, MIN_SPAN);
  return { lo: (min + max) / 2 - span / 2, span };
};

/** 값 → 캔버스 y(px). 값이 클수록 위 */
export const rateY = (v: number, band: RateBand, top = BAND_TOP, bottom = BAND_BOTTOM): number =>
  bottom - ((v - band.lo) / band.span) * (bottom - top);

export interface CostRateLineOpts {
  show:       boolean;
  /** 월별 원가율(%) — 못 구한 달은 null */
  rates:      (number | null)[];
  /** 예정(기준월 이후) 월 — 점선·연한 색 */
  future:     boolean[];
  color:      string;
  /** 원가가 매출을 넘는 달(100% 초과) 색 */
  lossColor:  string;
  /** 캡션·"–" 표시 색 */
  mutedColor: string;
  /** 점 안쪽 색(카드 배경색) */
  pointFill:  string;
  fontPx?:    number;
  spacing?:   string;
}

export const costRateLinePlugin: Plugin<'bar'> = {
  id: 'costRateLine',
  afterDatasetsDraw(chart) {
    const o = (chart.options.plugins as { costRateLine?: CostRateLineOpts } | undefined)?.costRateLine;
    if (!o?.show) return;
    const band = rateBand(o.rates);
    const xScale = chart.scales.x;
    if (!band || !xScale) return;

    const { ctx } = chart;
    const base = getDatalabelAlpha();   // "그래프 수치" 토글 페이드 — 수치 라벨과 같이 켜지고 꺼짐
    const xs = o.rates.map((_, i) => xScale.getPixelForValue(i));
    const ys = o.rates.map(v => (v == null ? null : rateY(v, band)));
    const isFuture = (i: number) => Boolean(o.future[i]);
    const isLoss = (v: number) => v > 100;
    const bandMid = (BAND_TOP + BAND_BOTTOM) / 2;

    ctx.save();
    ctx.textBaseline = 'middle';

    // 캡션 — 왼쪽 y축 자리
    ctx.globalAlpha = base;
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.fillStyle = o.mutedColor;
    ctx.textAlign = 'left';
    ctx.fillText('원가율', 2, bandMid);

    // 선 — 예정월로 가는 구간은 점선·연하게. 못 구한 달(null)에서는 끊김
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = o.color;
    for (let i = 1; i < xs.length; i++) {
      const y0 = ys[i - 1];
      const y1 = ys[i];
      if (y0 == null || y1 == null) continue;
      ctx.globalAlpha = base * (isFuture(i) ? FUTURE_ALPHA : 1);
      ctx.setLineDash(isFuture(i) ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(xs[i - 1], y0);
      ctx.lineTo(xs[i], y1);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 점 + 수치 + 못 구한 달 표시
    ctx.font = `bold ${o.fontPx ?? 11}px ${FONT_FAMILY}`;
    if (o.spacing) (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = o.spacing;
    ctx.textAlign = 'center';
    o.rates.forEach((v, i) => {
      ctx.globalAlpha = base * (isFuture(i) ? FUTURE_ALPHA : 1);
      const y = ys[i];
      if (v == null || y == null) {
        ctx.fillStyle = o.mutedColor;
        ctx.fillText('–', xs[i], bandMid);   // 매출이 없어 원가율을 못 구한 달
        return;
      }
      const c = isLoss(v) ? o.lossColor : o.color;
      ctx.beginPath();
      ctx.arc(xs[i], y, 4, 0, Math.PI * 2);
      ctx.fillStyle = o.pointFill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = c;
      ctx.stroke();
      ctx.fillStyle = c;
      ctx.fillText(`${v.toFixed(1)}%`, xs[i], y - 12);
    });
    ctx.restore();
  },
};
