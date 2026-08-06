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

const DEFAULT_COLORS = [
  'rgba(255,159,64,0.85)',
  'rgba(75,192,192,0.85)',
  'rgba(153,102,255,0.85)',
];

const DoughnutChart = ({
  labels,
  data,
  colors = DEFAULT_COLORS,
  showLabels = false,
  labelColor = '#1e293b',
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
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: labelColor,
            font: { size: 11 },
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
          color:   labelColor,
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
