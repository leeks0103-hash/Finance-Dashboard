import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import styles from './BarChart.module.css'; // wrap 클래스 공유

Chart.register(ArcElement, Tooltip, Legend, ChartDataLabels);

interface Props {
  labels:       string[];
  data:         number[];
  colors?:      string[];
  showLabels?:  boolean;
  labelColor?:  string;
}

// 현대 브랜드 9색 — Hyundai Blue / Active Blue / Sky Blue / Gold
const DEFAULT_COLORS = [
  'rgba(0,44,95,0.9)',
  'rgba(0,170,210,0.9)',
  'rgba(170,202,230,0.9)',
  'rgba(163,107,79,0.9)',
];

// 세그먼트 배경색 밝기에 맞춰 라벨을 흰색/어두운색으로 자동 대비 —
// costDirect가 Hyundai Blue(어두운 톤)로 바뀌면서 고정 labelColor(다크 텍스트)로는
// 어두운 세그먼트 위에서 안 보이는 문제가 생겨 세그먼트별 판단으로 교체
const arcTextColor = (bg: string): string => {
  const m = bg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return '#ffffff';
  const [r, g, b] = m.slice(1, 4).map(Number);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a1a1a' : '#ffffff';
};

const DoughnutChart = ({
  labels,
  data,
  colors = DEFAULT_COLORS,
  showLabels = false,
  labelColor = '#1a1a1a',
}: Props) => (
  <div className={styles.wrap}>
  <Doughnut
    data={{
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 0 }],
    }}
    options={{
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeInOutQuart' },
      // 얇은 세그먼트의 % 라벨이 캔버스 밖으로 나가 잘리지 않도록 여백 확보 (ChartCard가 overflow:hidden)
      layout: { padding: 12 },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: labelColor,
            font: { size: 13 },
            generateLabels: (chart) => {
              const ds   = chart.data.datasets[0];
              const nums = ds.data as number[];
              const total = nums.reduce((a, b) => a + b, 0);
              const bgs   = ds.backgroundColor as string[];
              return (chart.data.labels as string[]).map((label, i) => ({
                text:        `${label}  ${total > 0 ? ((nums[i] / total) * 100).toFixed(1) : 0}%`,
                fillStyle:   bgs[i],
                strokeStyle: bgs[i],
                fontColor:   labelColor,  // generateLabels에서 텍스트 색 직접 지정
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
            label: (ctx) => `${ctx.label}: ${(ctx.parsed as number).toFixed(1)}억원`,
          },
        },
        datalabels: {
          display: showLabels,
          color:   (ctx) => arcTextColor((ctx.dataset.backgroundColor as string[])[ctx.dataIndex]),
          font:    { size: 12, weight: 'bold' },
          textAlign: 'center',
          formatter: (value: number, ctx) => {
            const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
            if (!total || value === 0) return '';
            return `${((value / total) * 100).toFixed(1)}%`;
          },
        },
      },
    }}
  />
  </div>
);

export default DoughnutChart;
