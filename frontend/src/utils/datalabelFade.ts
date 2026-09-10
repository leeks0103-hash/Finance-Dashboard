import { Chart } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

// datalabels 플러그인 등록만 담당 (BarChart / DoughnutChart 등에서 import).
//
// 이전엔 "그래프 수치" 토글을 켤 때 숫자를 0→1로 페이드인시키는 로직이 있었으나,
// 페이드 도중 rAF 루프가 끊기면 라벨이 옅은 상태로 굳어버리는 문제가 있어 제거했다.
// 토글은 즉시 on/off (불투명도 항상 1).
Chart.register(ChartDataLabels);
