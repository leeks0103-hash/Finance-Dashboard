import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';

Chart.register(ArcElement, Tooltip, Legend);

interface Props {
  labels: string[];
  data: number[];
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
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
    }}
  />
);

export default DoughnutChart;
