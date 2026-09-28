import { Chart } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

// datalabels 플러그인 등록 + "그래프 수치" 토글 페이드 (BarChart / DoughnutChart 등에서 import).
//
// 켜기: display:true로 바뀐 뒤 불투명도 0→1 / 끄기: 불투명도 1→0이 끝난 뒤 display:false(=none).
// 순서 제어는 hooks/useChartLabelToggle, 여기는 전역 불투명도와 애니메이션만 담당.
//
// ⚠️ datalabels는 opacity를 afterUpdate에서만 계산하고 draw에선 캐시된 값을 쓴다 — 예전 페이드는
//   chart.draw()만 반복해서 값이 중간에서 굳었음(077ce35에서 제거된 이유). 그래서 매 프레임
//   chart.update('none')으로 다시 계산시키고, 마지막 프레임은 목표값을 정확히 넣어 끝낸다.

const DURATION = 220; // ms

let alpha = 1;
let rafId = 0;

/** 현재 수치 라벨 불투명도(0~1) — datalabels 외에 캔버스에 직접 그리는 라벨(목표선 수치 등)도 여기에 맞춤 */
export const getDatalabelAlpha = (): number => alpha;

const refreshAll = () => {
  for (const id in Chart.instances) {
    const chart = Chart.instances[id as unknown as number];
    // 페이드는 라벨만 — 막대 애니메이션은 다시 돌지 않게 'none'
    if (chart?.canvas?.isConnected) chart.update('none');
  }
};

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** 불투명도를 현재값 → to 로 애니메이션. 진행 중이던 페이드는 취소하고 그 지점부터 이어감 */
export const fadeDatalabels = (to: 0 | 1, onDone?: () => void) => {
  cancelAnimationFrame(rafId);
  const from = alpha;
  if (from === to || reducedMotion()) {
    alpha = to;
    refreshAll();
    onDone?.();
    return;
  }
  const dur = DURATION * Math.abs(to - from);
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / dur);
    alpha = from + (to - from) * (1 - (1 - t) ** 2);   // easeOutQuad
    if (t >= 1) alpha = to;
    refreshAll();
    if (t < 1) rafId = requestAnimationFrame(step);
    else onDone?.();
  };
  rafId = requestAnimationFrame(step);
};

/** 켜기 직전 — display:true로 재렌더되는 첫 프레임이 불투명도 0으로 그려지게 */
export const resetDatalabelAlpha = (value: 0 | 1) => {
  cancelAnimationFrame(rafId);
  alpha = value;
};

Chart.register(ChartDataLabels);

// datalabels 기본 opacity를 전역 불투명도로 — 개별 차트가 opacity를 지정하지 않는 한 적용(현재 지정하는 곳 없음)
const dlDefaults = Chart.defaults.plugins?.datalabels as Record<string, unknown> | undefined;
if (dlDefaults) dlDefaults.opacity = () => alpha;
