import { Chart, type Plugin } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { useUiStore } from '@/store';

/**
 * "그래프 수치" 토글을 켤 때 datalabel 숫자가 0→1로 부드럽게 떠오르도록 하는 side-effect 모듈.
 * (끌 때는 즉시 사라짐 — 끄는 순간 각 차트 옵션의 display가 false로 재렌더되어 라벨 자체가
 *  안 그려지므로 페이드아웃 여지가 없음. 켤 때만 처리한다.)
 *
 * BarChart / DoughnutChart 등 datalabel을 쓰는 차트 컴포넌트에서 이 모듈을 import 하면 적용된다.
 */

const DURATION = 280; // ms

// chart 인스턴스 → 페이드 시작 시각
const fading = new WeakMap<Chart, number>();

let prevOn = useUiStore.getState().showChartLabels;
useUiStore.subscribe((state) => {
  const on = state.showChartLabels;
  if (on && !prevOn) {
    // 켜지는 순간 — 현재 살아있는 모든 차트에 페이드 시작
    for (const id in Chart.instances) {
      const chart = Chart.instances[id as unknown as number];
      if (chart) {
        fading.set(chart, performance.now());
        chart.draw();
      }
    }
  }
  prevOn = on;
});

/** datalabels 플러그인의 scriptable `opacity` — 페이드 중이면 0→1 보간, 아니면 1 */
export const datalabelOpacity = (ctx: { chart: Chart }): number => {
  const start = fading.get(ctx.chart);
  if (start === undefined) return 1;
  const t = (performance.now() - start) / DURATION;
  if (t >= 1) {
    fading.delete(ctx.chart);
    return 1;
  }
  return t < 0 ? 0 : t;
};

/** 페이드가 끝날 때까지 매 프레임 다시 그리게 하는 플러그인.
 *  라벨이 하나도 안 보이는 차트(=datalabelOpacity가 호출되지 않는 차트)도 여기서 시간 기준으로
 *  정리해 rAF 루프가 무한히 도는 것을 막는다. */
const fadePlugin: Plugin = {
  id: 'datalabelFade',
  afterDraw(chart) {
    const start = fading.get(chart);
    if (start === undefined) return;
    if (performance.now() - start >= DURATION || !Chart.instances[chart.id]) {
      fading.delete(chart);
      return;
    }
    requestAnimationFrame(() => chart.draw());
  },
};

Chart.register(ChartDataLabels, fadePlugin);

// datalabels 기본 opacity를 페이드 함수로 — 개별 차트 옵션에서 opacity를 지정하지 않는 한 적용됨
const dlDefaults = Chart.defaults.plugins?.datalabels as Record<string, unknown> | undefined;
if (dlDefaults) dlDefaults.opacity = datalabelOpacity;
