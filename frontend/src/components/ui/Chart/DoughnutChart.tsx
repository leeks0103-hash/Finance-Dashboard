import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(ArcElement, Tooltip, Legend, ChartDataLabels);

interface Props {
  labels:      string[];
  data:        number[];
  colors?:     string[];
  showLabels?: boolean;
}

const DEFAULT_COLORS = [
  'rgba(255,159,64,0.85)',
  'rgba(75,192,192,0.85)',
  'rgba(153,102,255,0.85)',
];

const DoughnutChart = ({ labels, data, colors = DEFAULT_COLORS, showLabels = false }: Props) => (
  <Doughnut
    data={{
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 1 }],
    }}
    options={{
      responsive: true,
      maintainAspectRatio: false,
      animation: false,  // 수치 토글 시 재애니메이션 방지
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { size: 11 },
            // 범례에 항목명 + % 함께 표시
            generateLabels: (chart) => {
              const ds     = chart.data.datasets[0];
              const nums   = ds.data as number[];
              const total  = nums.reduce((a, b) => a + b, 0);
              const bgs    = ds.backgroundColor as string[];
              return (chart.data.labels as string[]).map((label, i) => ({
                text:        `${label}  ${total > 0 ? ((nums[i] / total) * 100).toFixed(1) : 0}%`,
                fillStyle:   bgs[i],
                strokeStyle: bgs[i],
                lineWidth:   0,
                hidden:      false,
                index:       i,
                datasetIndex: 0,
              }));
            },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed as number;
              return `${ctx.label}: ${v.toFixed(2)}억원`;
            },
          },
        },
        datalabels: {
          display: showLabels,
          color:   '#111827',      // 검정에 가까운 색 — 흰 배경에서도 잘 보임
          font:    { size: 12, weight: 'bold' },
          textAlign: 'center',
          // 세그먼트 안에 % 만 표시 — 라벨 텍스트는 범례에서 확인
          formatter: (value: number, ctx) => {
            const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
            if (!total || value === 0) return '';
            const pct = ((value / total) * 100).toFixed(1);
            return `${pct}%`;
          },
        },
      },
    }}
  />
);

export default DoughnutChart;
