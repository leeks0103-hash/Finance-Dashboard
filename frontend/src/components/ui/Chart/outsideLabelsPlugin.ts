import type { ChartType, Plugin } from 'chart.js';

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
   *  'lg' — 확대 모달처럼 캔버스가 큰 곳 전용, 인출선·글자를 크게. 서로 독립 — 하나 조정해도 다른 쪽엔 영향 없음. */
  size?: 'sm' | 'lg';
}

const SIZE_PRESET = {
  sm: { r1: 3,  r2: 11, horiz: 8,  font: 10 },
  lg: { r1: 6,  r2: 24, horiz: 14, font: 13 },
} as const;

interface LabelItem {
  x0: number; y0: number;   // 도넛 중심
  cos: number; sin: number; // 조각 중심각
  isRight: boolean;
  r1: number; r2: number; horiz: number;
  naturalY: number;         // 겹침 보정 전 y (인출선 꺾이는 지점)
  y: number;                // 겹침 보정 후 y (draw 단계에서 갱신)
  text: string;
  color: string;
}

// 같은 쪽(좌/우)에서 라벨끼리 세로로 너무 가까우면(겹치면) 위→아래 순으로 최소 간격만큼 밀어낸다.
// (예: 얇은 조각 여러 개가 붙어있으면 인출선 끝 y가 비슷해져 텍스트가 겹침 — 실사용 스샷으로 확인된 문제)
const resolveOverlaps = (items: LabelItem[], minGap: number) => {
  items.sort((a, b) => a.naturalY - b.naturalY);
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const cur  = items[i];
    if (cur.y < prev.y + minGap) cur.y = prev.y + minGap;
  }
};

/**
 * 도넛 조각 비율이 작으면(예: 0.1%) 링 안쪽 라벨이 얇은 조각에 눌려 안 보임 —
 * 링 바깥으로 짧은 인출선을 긋고 그 끝에 조각 색과 같은 색으로 텍스트를 그린다.
 * 인접한 얇은 조각이 여러 개면 인출선 끝 위치가 겹치므로, 좌/우 반쪽마다 세로로
 * 최소 간격을 두고 밀어내는 보정을 거친다(인출선은 진짜 각도에서 시작해 살짝 꺾여 나감).
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
        text:  `${((value / sum) * 100).toFixed(1)}%`,
        color: colors[i] ?? '#1a1a1a',
      });
    });
    if (!items.length) return;

    ctx.save();
    ctx.font = `700 ${preset.font}px 'HyundaiSans', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;

    const minGap = preset.font + 4;
    resolveOverlaps(items.filter(it => it.isRight), minGap);
    resolveOverlaps(items.filter(it => !it.isRight), minGap);

    for (const it of items) {
      const x1 = it.x0 + it.cos * it.r1, y1 = it.y0 + it.sin * it.r1;
      const x2 = it.x0 + it.cos * it.r2;                       // 꺾이는 지점 x는 원래 각도 기준
      const x3 = x2 + (it.isRight ? it.horiz : -it.horiz);     // 수평 마무리

      ctx.strokeStyle = it.color;
      ctx.fillStyle   = it.color;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, it.y);   // 겹침 보정된 y로 — 겹칠 땐 살짝 비스듬히 꺾여 나감
      ctx.lineTo(x3, it.y);
      ctx.stroke();

      ctx.textAlign = it.isRight ? 'left' : 'right';
      ctx.fillText(it.text, x3 + (it.isRight ? 4 : -4), it.y);
    }

    ctx.restore();
  },
};

export default outsideLabelsPlugin;
