import { Bar } from 'react-chartjs-2';
import {
  Chart, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import type { ChartData, ChartOptions, ChartEvent, ActiveElement } from 'chart.js';
import styles from './BarChart.module.css';

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, ChartDataLabels);

interface Props {
  labels:      string[];
  datasets:    ChartData<'bar'>['datasets'];
  horizontal?: boolean;
  options?:    ChartOptions<'bar'>;
  onClick?:    (label: string) => void;
}

const BarChart = ({ labels, datasets, horizontal = false, options, onClick }: Props) => {
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
    onClick: (_event: ChartEvent, elements: ActiveElement[], chart: Chart) => {
      if (elements.length > 0 && onClick) {
        const label = chart.data.labels?.[elements[0].index];
        if (label != null) onClick(String(label));
      }
    },
  };

  return (
    <div className={styles.wrap}>
      <Bar data={{ labels, datasets }} options={merged} />
    </div>
  );
};

export default BarChart;
