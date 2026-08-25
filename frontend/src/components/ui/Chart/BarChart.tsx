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
    hoverBorderWidth: 0,
  }));

  const pluginsInput = options?.plugins ?? {};
  const legendRaw: unknown = pluginsInput.legend;
  const { legend: legendOpts, ...otherPlugins } = pluginsInput;
  // chart.js는 런타임에 plugins.legend: false로 범례 자체를 끌 수 있지만 타입 정의는 이를 모델링하지 않음 —
  // 객체로 간주해 스프레드하면 false가 조용히 무시되고 기본 범례가 다시 나타나므로 별도 분기 필요
  const merged: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    ...options,
    plugins: {
      legend: legendRaw === false
        ? (false as unknown as NonNullable<ChartOptions<'bar'>['plugins']>['legend'])
        : { position: 'bottom', labels: { font: { size: 11 } }, ...(legendOpts ?? {}) },
      datalabels: { display: false },  // 각 차트에서 options.plugins.datalabels로 override
      ...otherPlugins,
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
