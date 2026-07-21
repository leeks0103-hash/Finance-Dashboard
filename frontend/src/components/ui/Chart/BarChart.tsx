import { Bar } from 'react-chartjs-2';
import {
  Chart, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import type { ChartData, ChartOptions } from 'chart.js';

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, ChartDataLabels);

interface Props {
  labels:     string[];
  datasets:   ChartData<'bar'>['datasets'];
  horizontal?: boolean;
  options?:   ChartOptions<'bar'>;
}

const BarChart = ({ labels, datasets, horizontal = false, options }: Props) => {
  const merged: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    ...options,
    plugins: {
      legend:      { position: 'bottom', labels: { font: { size: 11 } } },
      datalabels:  { display: false },  // 각 차트에서 options.plugins.datalabels로 override
      ...options?.plugins,
    },
  };

  return <Bar data={{ labels, datasets }} options={merged} />;
};

export default BarChart;
