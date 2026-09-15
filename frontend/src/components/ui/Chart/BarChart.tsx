import { useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
  LineElement, PointElement, LineController,
} from 'chart.js';
import type { ChartData, ChartDataset, ChartOptions, ChartEvent, ActiveElement } from 'chart.js';
import { Button } from '@/components/ui/Button';
// datalabels 등록 + "그래프 수치" 토글 켤 때 숫자 페이드인 (side-effect)
import '@/utils/datalabelFade';
import styles from './BarChart.module.css';

// LineElement/PointElement/LineController — 막대 위에 "목표선" 같은 line 데이터셋을 섞어
// 그리는(mixed chart) 차트 전용으로 추가 등록. bar만 쓰는 기존 차트엔 영향 없음.
Chart.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend, LineElement, PointElement, LineController);

// Chart.js는 CSS font-family를 무시 — 전역 폰트 직접 주입.
// GmarketSans/Pretendard는 이 프로젝트에 로드되지 않아(=@font-face·폰트 파일 없음) 실제로는
// 시스템 sans-serif(맑은 고딕)로 떨어졌고, 굵은 글씨가 번져 보이는 원인이었음 —
// body와 같은 HyundaiSans로 통일(700 실제 굵기 파일이 있어 가짜 볼드가 생기지 않음)
Chart.defaults.font.family = "'HyundaiSans', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";
Chart.defaults.font.size   = 13;

interface Props {
  labels:      string[];
  /** 기본은 막대 데이터셋. "목표선" 등 line 데이터셋을 섞고 싶으면 { type: 'line', ... }를
   *  섞어서 넘기면 된다(위 LineElement/PointElement/LineController 등록으로 mixed chart 지원). */
  datasets:    ChartData<'bar'>['datasets'] | (ChartDataset<'bar'> | ChartDataset<'line'>)[];
  horizontal?: boolean;
  options?:    ChartOptions<'bar'>;
  /** 막대 클릭 — 라벨(카테고리)과 데이터셋 인덱스(0=첫 시리즈)를 넘긴다 */
  onClick?:    (label: string, datasetIndex: number) => void;
  /** true면 우측 상단에 "이미지로 저장" 버튼 노출 — 필요한 차트에서만 opt-in */
  exportable?: boolean;
}

// rgba(r,g,b,a) → rgba(r,g,b,1) — 호버 시 완전 불투명으로 밝게
const toHoverColor = (c: string) => c.replace(/[\d.]+\)$/, '1)');

const BarChart = ({ labels, datasets, horizontal = false, options, onClick, exportable = false }: Props) => {
  const chartRef = useRef<Chart<'bar'> | null>(null);

  const boosted = datasets.map(d => (
    d.type === 'line' ? d : {
      ...d,
      hoverBackgroundColor: typeof d.backgroundColor === 'string'
        ? toHoverColor(d.backgroundColor)
        : Array.isArray(d.backgroundColor)
          ? (d.backgroundColor as string[]).map(toHoverColor)
          : d.backgroundColor,
      hoverBorderWidth: 0,
    }
  ));

  // 카테고리축 눈금 라벨(가로 막대면 왼쪽, 세로 막대면 아래) 영역에 마우스가 있으면
  // 그 카테고리 index를 돌려준다 — 라벨 텍스트도 클릭 대상으로 쓰기 위함(막대 클릭인 줄 모르는 문제)
  const catLabelHit = (event: ChartEvent, chart: Chart): number => {
    const area = chart.chartArea;
    const x = event.x ?? -1;
    const y = event.y ?? -1;
    const count = chart.data.labels?.length ?? 0;
    if (horizontal) {
      if (x <= 0 || x >= area.left || y < area.top || y > area.bottom) return -1;
      const idx = Math.round(chart.scales.y?.getValueForPixel?.(y) ?? -1);
      return idx >= 0 && idx < count ? idx : -1;
    }
    if (y <= area.bottom || y >= chart.height || x < area.left || x > area.right) return -1;
    const idx = Math.round(chart.scales.x?.getValueForPixel?.(x) ?? -1);
    return idx >= 0 && idx < count ? idx : -1;
  };

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
        : { position: 'bottom', labels: { font: { size: 13 } }, ...(legendOpts ?? {}) },
      datalabels: { display: false },  // 각 차트에서 options.plugins.datalabels로 override
      ...otherPlugins,
    },
    onClick: (event: ChartEvent, elements: ActiveElement[], chart: Chart) => {
      if (!onClick) return;
      // 목표선 등 line 데이터셋은 드릴다운 대상이 아님(프로젝트 합산값이 아니라 계획 수치라
      // 같은 breakdown API로 조회할 수 없음) — 막대(bar) 히트만 클릭으로 인정
      const barHit = elements.find(el => chart.data.datasets[el.datasetIndex]?.type !== 'line');
      if (barHit) {
        const { index, datasetIndex } = barHit;
        const label = chart.data.labels?.[index];
        if (label != null) onClick(String(label), datasetIndex);
        return;
      }
      // 막대가 아니라 축 라벨 텍스트를 클릭한 경우 — 시리즈 미지정(-1)
      const li = catLabelHit(event, chart);
      if (li >= 0) {
        const label = chart.data.labels?.[li];
        if (label != null) onClick(String(label), -1);
      }
    },
    // onClick이 있을 때만 막대·축 라벨 위에서 포인터 커서 — 클릭 가능함을 알린다
    onHover: onClick
      ? (event: ChartEvent, elements: ActiveElement[], chart: Chart) => {
          const barHover = elements.some(el => chart.data.datasets[el.datasetIndex]?.type !== 'line');
          const hit = barHover || catLabelHit(event, chart) >= 0;
          (chart.canvas as HTMLCanvasElement).style.cursor = hit ? 'pointer' : 'default';
        }
      : undefined,
  };

  const handleExportPng = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const url = chart.toBase64Image();
    const a = document.createElement('a');
    a.href = url;
    a.download = `chart_${Date.now()}.png`;
    a.click();
  };

  return (
    <div className={styles.wrap}>
      {exportable && (
        <Button
          unstyled
          className={styles.exportBtn}
          onClick={handleExportPng}
          title="이미지로 저장"
          aria-label="이미지로 저장"
        >
          ⬇
        </Button>
      )}
      <Bar
        ref={chartRef}
        data={{ labels, datasets: boosted as ChartData<'bar'>['datasets'] }}
        options={merged}
      />
    </div>
  );
};

export default BarChart;
