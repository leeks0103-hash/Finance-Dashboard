import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Tooltip, Legend, Filler,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import type { ChartOptions } from 'chart.js';
import styles from './BarChart.module.css';

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Tooltip, Legend, Filler, ChartDataLabels,
);

export interface MixedDataset {
  type:            'bar' | 'line';
  label:           string;
  data:            number[];
  backgroundColor?: string | string[];
  borderColor?:    string;
  borderWidth?:    number;
  borderRadius?:   number;
  pointRadius?:    number;
  pointHoverRadius?: number;
  tension?:        number;
  fill?:           boolean;
  yAxisID?:        string;
  order?:          number;
  datalabels?:     Record<string, unknown>;
}

interface Props {
  labels:   string[];
  datasets: MixedDataset[];
  options?: ChartOptions<'bar'>;
}

const MixedBarLineChart = ({ labels, datasets, options }: Props) => {
  const merged: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    ...options,
    plugins: {
      legend:     { position: 'bottom', labels: { font: { size: 11 } } },
      datalabels: { display: false },
      ...options?.plugins,
    },
  };

  return (
    <div className={styles.wrap}>
      <Chart type="bar" data={{ labels, datasets: datasets as never }} options={merged} />
    </div>
  );
};

export default MixedBarLineChart;
