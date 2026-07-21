import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(ArcElement, Tooltip, Legend, ChartDataLabels);

interface Props {
  labels:  string[];
  data:    number[];
  colors?: string[];
}

const DEFAULT_COLORS = [
  'rgba(255,159,64,0.85)',
  'rgba(75,192,192,0.85)',
  'rgba(153,102,255,0.85)',
];

const DoughnutChart = ({ labels, data, colors = DEFAULT_COLORS }: Props) => (
  <Doughnut
    data={{
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 1 }],
    }}
    options={{
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 } } },
        datalabels: {
          display: true,
          color: '#fff',
          font: { size: 12, weight: 'bold' },
          textAlign: 'center',
          formatter: (value: number, ctx) => {
            const dataset = ctx.dataset.data as number[];
            const total   = dataset.reduce((a, b) => a + b, 0);
            if (!total || value === 0) return '';
            const pct = ((value / total) * 100).toFixed(1);
            const label = (ctx.chart.data.labels?.[ctx.dataIndex] as string) ?? '';
            return `${label}\n${pct}%`;
          },
        },
      },
    }}
  />
);

export default DoughnutChart;
