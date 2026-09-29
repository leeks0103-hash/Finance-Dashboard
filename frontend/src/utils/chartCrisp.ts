import { Chart, type Plugin } from 'chart.js';

// 캔버스 글씨 번짐 방지 — Chart.js는 표시 크기(style)를 소수 첫째 자리까지 두고(예: 526.3px)
// 실제 픽셀(canvas.height)은 정수로 잘라서(526.3 × 1.25 = 657.9 → 657), 윈도우 배율 125%처럼
// DPR이 정수가 아니면 캔버스가 1px 미만으로 늘려 그려지며 글씨가 흐려진다(2026-09-29 실측).
// 그리기 직전에 표시 크기를 "캔버스 픽셀 ÷ DPR"로 맞춰 1:1로 찍히게 한다.
// resize 훅만으론 부족 — 크기가 안 바뀐 resize에서도 Chart.js가 style을 소수값으로 다시 써서.
const crispCanvasPlugin: Plugin = {
  id: 'crispCanvas',
  beforeDraw(chart) {
    const canvas = chart.canvas;
    const dpr = chart.currentDevicePixelRatio || 1;
    if (!canvas?.style || !canvas.width || !canvas.height) return;
    const w = `${canvas.width / dpr}px`;
    const h = `${canvas.height / dpr}px`;
    if (canvas.style.width !== w) canvas.style.width = w;
    if (canvas.style.height !== h) canvas.style.height = h;
  },
};

Chart.register(crispCanvasPlugin);
