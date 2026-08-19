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

// rgba(r,g,b,a) → rgba(r,g,b,1) — 호버 시 완전 불투명으로 밝게
const toHoverColor = (c: string) => c.replace(/[\d.]+\)$/, '1)');

const BarChart = ({ labels, datasets, horizontal = false, options, onClick }: Props) => {
  const boosted = datasets.map(d => ({
    ...d,
    hoverBackgroundColor: typeof d.backgroundColor === 'string'
      ? toHoverColor(d.backgroundColor)
      : Array.isArray(d.backgroundColor)
        ? (d.backgroundColor as string[]).map(toHoverColor)
        : d.backgroundColor,
    hoverBorderWidth: 2,
    hoverBorderColor: 'rgba(0,0,0,0.18)',
  }));

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
      <Bar data={{ labels, datasets: boosted }} options={merged} />
    </div>
  );
};

export default BarChart;
