import { Bar } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import type { ChartData, ChartOptions } from 'chart.js';

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface Props {
  labels: string[];
  datasets: ChartData<'bar'>['datasets'];
  horizontal?: boolean;
  options?: ChartOptions<'bar'>;
}

const BarChart = ({ labels, datasets, horizontal = false, options }: Props) => (
  <Bar
    data={{ labels, datasets }}
    options={{
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
      ...options,
    }}
  />
);

export default BarChart;
