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
}

/**
 * 도넛 조각 비율이 작으면(예: 0.1%) 링 안쪽 라벨이 얇은 조각에 눌려 안 보임 —
 * 링 바깥으로 짧은 인출선을 긋고 그 끝에 조각 색과 같은 색으로 텍스트를 그린다
 * (참고: 얇은 파이차트 조각을 바깥 라벨+리더라인으로 표시하는 흔한 방식).
 * `showLabels`(전역 "그래프 수치" 토글)와 별개로, 이 플러그인이 켜진 차트에서만 동작 —
 * 값이 0인 조각(숨김 포함)은 건너뛴다.
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

    const colors = (dataset.backgroundColor as string[]) ?? [];
    const { ctx } = chart;

    ctx.save();
    ctx.font = "700 11px 'HyundaiSans', sans-serif";
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;

    meta.data.forEach((arc, i) => {
      const value = values[i];
      if (!value || !chart.getDataVisibility(i)) return;

      const el = arc as unknown as ArcLike;
      const mid = (el.startAngle + el.endAngle) / 2;
      const cos = Math.cos(mid);
      const sin = Math.sin(mid);
      const isRight = cos >= 0;

      const r1 = el.outerRadius + 4;    // 링 바로 바깥 — 인출선 시작점
      const r2 = el.outerRadius + 16;   // 꺾이는 지점
      const x1 = el.x + cos * r1, y1 = el.y + sin * r1;
      const x2 = el.x + cos * r2, y2 = el.y + sin * r2;
      const x3 = x2 + (isRight ? 12 : -12);   // 수평 마무리 선

      const color = colors[i] ?? '#1a1a1a';
      ctx.strokeStyle = color;
      ctx.fillStyle   = color;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y2);
      ctx.stroke();

      ctx.textAlign = isRight ? 'left' : 'right';
      ctx.fillText(`${((value / sum) * 100).toFixed(1)}%`, x3 + (isRight ? 4 : -4), y2);
    });

    ctx.restore();
  },
};

export default outsideLabelsPlugin;
