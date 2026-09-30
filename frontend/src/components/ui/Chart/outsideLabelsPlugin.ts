import type { ChartType, Plugin } from 'chart.js';
import { getDatalabelAlpha } from '@/utils/datalabelFade';

// Chart.js 커스텀 플러그인 옵션 타입 등록 — options.plugins.outsideLabels 에 타입 부여
declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    outsideLabels?: OutsideLabelsOpts;
  }
}

interface ArcLike {
  startAngle:   number;
  endAngle:     number;
  outerRadius:  number;
  x:            number;
  y:            number;
}

interface OutsideLabelsOpts {
  enabled?: boolean;
  /** 'sm'(기본) — 컴팩트 카드용, 인출선을 짧게 잡아 링 크기에 거의 영향 없음.
   *  'md' — 메인 화면 단독 카드(실적 탭 전체 평균 원가 비율) — 글자만 sm보다 2px 크게.
   *  'lg' — 확대 모달처럼 캔버스가 큰 곳 전용, 인출선·글자를 크게. 서로 독립 — 하나 조정해도 다른 쪽엔 영향 없음. */
  size?: 'sm' | 'md' | 'lg';
  /** true면 "123.4억(45.2%)"처럼 금액도 같이(값은 이미 억 단위). 기본은 비중(%)만 */
  showValue?: boolean;
}

const SIZE_PRESET = {
  sm: { r1: 3,  r2: 12, horiz: 9,  font: 12 },
  md: { r1: 3,  r2: 12, horiz: 9,  font: 14 },
  lg: { r1: 6,  r2: 25, horiz: 15, font: 16 },
} as const;

/** 인출선 라벨·범례 공통 표기 — 여백 계산도 같은 문자열로 재야 어긋나지 않음 */
export const formatOutsideLabel = (value: number, sum: number, showValue?: boolean): string => {
  const pct = `${(sum ? (value / sum) * 100 : 0).toFixed(1)}%`;
  return showValue ? `${value.toFixed(1)}억(${pct})` : pct;
};

/** 인출선 라벨 줄 — showValue면 "237.5억" / "(64.8%)" 두 줄. 한 줄로 쓰면 라벨 폭만큼 좌우 여백을
 *  먹어서 도넛 링이 너무 작아졌음(2026-09-29) — 두 줄이면 폭이 절반 가까이로 줄어듦 */
const labelLines = (value: number, sum: number, showValue?: boolean): string[] => {
  const pct = `${(sum ? (value / sum) * 100 : 0).toFixed(1)}%`;
  return showValue ? [`${value.toFixed(1)}억`, `(${pct})`] : [pct];
};

/** 라벨 글자색 — 밝은 조각색(Sky Blue 등, 공통원가)은 흰 배경에 묻혀서 같은 색에 검정을 30% 섞어 진하게.
 *  그림자는 오히려 번져 보여서 반려(2026-09-29). 그 외 색은 조각색 그대로 */
const labelTextColor = (c: string): string => {
  const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return c;
  const [r, g, b] = m.slice(1, 4).map(Number);
  if ((0.299 * r + 0.587 * g + 0.114 * b) / 255 <= 0.65) return c;
  const k = 0.7;
  return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
};

let measureCtx: CanvasRenderingContext2D | null | undefined;
const measureTextWidth = (text: string, font: string): number => {
  if (measureCtx === undefined) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return 0;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
};

/** showValue면 라벨 길이가 값 크기에 따라 달라져 고정 여백으로는 잘림 — 실제 텍스트 폭을 재서 계산.
 *  showValue가 아니면 기존 고정값(lg 68 / sm 24) 그대로 */
export const computeOutsideLabelPadding = (
  values: number[], sum: number, showValue: boolean | undefined, size: 'sm' | 'lg',
): number => {
  if (!showValue) return size === 'lg' ? 68 : 24;
  const preset = SIZE_PRESET[size];
  const font = `700 ${preset.font}px 'HyundaiSans', sans-serif`;
  // 최소 "000.0억" / "(00.0%)" 폭 — 값이 이보다 짧아도 같은 여백 → 나란히 놓인 도넛끼리 링 크기가 같아짐
  // (전사평균 237.5억 vs 파트 37.0억처럼 자릿수만 달라도 링 크기가 달라 보였음, 2026-09-29)
  const widest = (lines: string[]) => Math.max(...lines.map(l => measureTextWidth(l, font)));
  const minW = widest(['000.0억', '(00.0%)']);
  const maxW = values.reduce((m, v) => Math.max(m, widest(labelLines(v, sum, true))), minW);
  return Math.ceil(preset.r2 + preset.horiz + maxW) + 12;
};

interface LabelItem {
  x0: number; y0: number;   // 도넛 중심
  cos: number; sin: number; // 조각 중심각
  isRight: boolean;
  r1: number; r2: number; horiz: number;
  naturalY: number;         // 겹침 보정 전 y (인출선 꺾이는 지점)
  y: number;                // 겹침 보정 후 y (draw 단계에서 갱신)
  lines: string[];
  color: string;
}

// 같은 쪽(좌/우)에서 라벨끼리 세로로 너무 가까우면(겹치면) 최소 간격만큼 벌린다.
// 얇은 조각 여러 개가 붙어 있으면 인출선 끝 y가 비슷해져 글자가 겹침 — 실사용 스샷으로 확인된 문제.
//  · 예전엔 위 → 아래 한 방향으로만 밀어서 첫 라벨만 제자리고 나머지는 자기 조각에서 점점 멀어졌음
//    → 서로 반씩 밀어내(묶음 가운데가 원래 위치에 남음) 조각 근처에 고르게 퍼지게
//  · 캔버스 위아래(lo~hi) 밖으로 나가면 잘리므로 그 안에 가둠. 마지막에 한 번 더 훑어 간격을 보장
const resolveOverlaps = (items: LabelItem[], minGap: number, lo: number, hi: number) => {
  if (!items.length) return;
  items.sort((a, b) => a.naturalY - b.naturalY);
  const clamp = () => items.forEach(it => { it.y = Math.min(hi, Math.max(lo, it.y)); });
  for (let iter = 0; iter < 80; iter++) {
    let moved = false;
    for (let i = 1; i < items.length; i++) {
      const d = items[i].y - items[i - 1].y;
      if (d < minGap - 0.01) {
        const push = (minGap - d) / 2;
        items[i - 1].y -= push;
        items[i].y     += push;
        moved = true;
      }
    }
    clamp();
    if (!moved) break;
  }
  for (let i = 1; i < items.length; i++) {
    if (items[i].y < items[i - 1].y + minGap) items[i].y = items[i - 1].y + minGap;
  }
  const last = items[items.length - 1];
  if (last.y > hi) {
    last.y = hi;
    for (let i = items.length - 2; i >= 0; i--) {
      if (items[i].y > items[i + 1].y - minGap) items[i].y = items[i + 1].y - minGap;
    }
  }
};

/** 보정된 y에서 인출선이 꺾이는 x — 링 바깥 원(반지름 r2) 위의 점. 예전엔 y만 옮기고 x는 원래 각도 그대로라,
 *  아래로 밀린 라벨이 링이 더 넓어지는 자리에서 링 위에 올라앉았음(글자가 조각을 덮음, 2026-09-30).
 *  y가 원 밖(꼭대기보다 위 / 바닥보다 아래)이면 원래 x를 그대로 씀 */
const elbowX = (it: LabelItem): number => {
  const dy = it.y - it.y0;
  if (Math.abs(dy) >= it.r2) return it.x0 + it.cos * it.r2;
  return it.x0 + (it.isRight ? 1 : -1) * Math.sqrt(it.r2 * it.r2 - dy * dy);
};

/**
 * 도넛 조각 비율이 작으면(예: 0.1%) 링 안쪽 라벨이 얇은 조각에 눌려 안 보임 —
 * 링 바깥으로 짧은 인출선을 긋고 그 끝에 조각 색과 같은 색으로 텍스트를 그린다.
 * 인접한 얇은 조각이 여러 개면 인출선 끝 위치가 겹치므로, 좌/우 반쪽마다 세로로
 * 최소 간격을 두고 벌린 뒤 링 바깥 원을 따라 x를 다시 잡는다(인출선은 진짜 각도에서 시작해 살짝 꺾여 나감).
 * `showLabels`(전역 "그래프 수치" 토글)와 별개로, 이 플러그인이 켜진 차트에서만 동작.
 */
export const outsideLabelsPlugin: Plugin<'doughnut'> = {
  id: 'outsideLabels',
  afterDraw(chart, _args, opts: OutsideLabelsOpts) {
    if (!opts?.enabled) return;
    const meta    = chart.getDatasetMeta(0);
    const dataset = chart.data.datasets[0];
    const values  = (dataset?.data as number[]) ?? [];
    const sum     = values.reduce((a, b) => a + (b || 0), 0);
    if (!sum) return;

    const preset = SIZE_PRESET[opts.size ?? 'sm'];
    const colors = (dataset.backgroundColor as string[]) ?? [];
    const { ctx } = chart;

    const items: LabelItem[] = [];
    meta.data.forEach((arc, i) => {
      const value = values[i];
      if (!value || !chart.getDataVisibility(i)) return;

      const el  = arc as unknown as ArcLike;
      const mid = (el.startAngle + el.endAngle) / 2;
      const cos = Math.cos(mid);
      const sin = Math.sin(mid);
      const r1  = el.outerRadius + preset.r1;
      const r2  = el.outerRadius + preset.r2;
      const naturalY = el.y + sin * r2;

      items.push({
        x0: el.x, y0: el.y, cos, sin, isRight: cos >= 0,
        r1, r2, horiz: preset.horiz,
        naturalY, y: naturalY,
        lines: labelLines(value, sum, opts.showValue),
        color: colors[i] ?? '#1a1a1a',
      });
    });
    if (!items.length) return;

    ctx.save();
    ctx.globalAlpha = getDatalabelAlpha();   // "그래프 수치" 토글 페이드를 다른 차트 라벨과 같이 탐
    ctx.font = `700 ${preset.font}px 'HyundaiSans', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;

    const lineH  = preset.font + 2;
    const labelH = lineH * (opts.showValue ? 2 : 1);
    const minGap = labelH + 4;   // 두 줄 라벨은 그만큼 더 띄움
    const lo = labelH / 2 + 2;
    const hi = chart.height - labelH / 2 - 2;
    resolveOverlaps(items.filter(it => it.isRight), minGap, lo, hi);
    resolveOverlaps(items.filter(it => !it.isRight), minGap, lo, hi);

    for (const it of items) {
      const x1 = it.x0 + it.cos * it.r1, y1 = it.y0 + it.sin * it.r1;
      const x2 = elbowX(it);                                   // 꺾이는 지점 — 보정된 y에서 링 바깥 원 위
      const x3 = x2 + (it.isRight ? it.horiz : -it.horiz);     // 수평 마무리

      ctx.strokeStyle = it.color;
      ctx.fillStyle   = it.color;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, it.y);   // 겹침 보정된 y로 — 겹칠 땐 살짝 비스듬히 꺾여 나감
      ctx.lineTo(x3, it.y);
      ctx.stroke();

      ctx.textAlign = it.isRight ? 'left' : 'right';
      ctx.fillStyle = labelTextColor(it.color);
      // 여러 줄이면 인출선 끝(it.y)을 가운데로 위아래 배치
      const y0 = it.y - ((it.lines.length - 1) * lineH) / 2;
      it.lines.forEach((line, k) => ctx.fillText(line, x3 + (it.isRight ? 4 : -4), y0 + k * lineH));
    }

    ctx.restore();
  },
};

export default outsideLabelsPlugin;
