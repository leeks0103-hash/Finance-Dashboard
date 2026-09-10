import { useRef, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import { Button } from '@/components/ui/Button';
// datalabels 등록 + "그래프 수치" 토글 켤 때 숫자 페이드인 (side-effect)
import '@/utils/datalabelFade';
import styles from './DoughnutChart.module.css';

Chart.register(ArcElement, Tooltip, Legend);

interface Props {
  labels:       string[];
  data:         number[];
  colors?:      string[];
  showLabels?:  boolean;
  /** 세그먼트(또는 범례 항목) 클릭 — 인덱스와 라벨. 지정 시 조각 위 커서가 포인터로 바뀐다 */
  onSliceClick?: (index: number, label: string) => void;
}

// 현대 브랜드 9색 — Hyundai Blue / Active Blue / Sky Blue / Gold
const DEFAULT_COLORS = [
  'rgba(0,44,95,0.9)',
  'rgba(0,170,210,0.9)',
  'rgba(170,202,230,0.9)',
  'rgba(163,107,79,0.9)',
];

// 세그먼트 배경색 밝기에 맞춰 라벨을 흰색/어두운색으로 자동 대비 —
// costDirect가 Hyundai Blue(어두운 톤)로 바뀌면서 고정 labelColor(다크 텍스트)로는
// 어두운 세그먼트 위에서 안 보이는 문제가 생겨 세그먼트별 판단으로 교체
const arcTextColor = (bg: string): string => {
  const m = bg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return '#ffffff';
  const [r, g, b] = m.slice(1, 4).map(Number);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1a1a1a' : '#ffffff';
};

const DoughnutChart = ({
  labels,
  data,
  colors = DEFAULT_COLORS,
  showLabels = false,
  onSliceClick,
}: Props) => {
  const total = data.reduce((a, b) => a + b, 0);

  // 범례 텍스트 클릭 시 해당 세그먼트 숨김/복원 — Chart.js 기본 범례가 하던 토글을
  // 커스텀 HTML 범례(2열 그리드)로 바꾸면서 빠졌던 동작. toggleDataVisibility로 재구현
  const chartRef = useRef<Chart<'doughnut', number[], string> | null>(null);
  const [hiddenIdx, setHiddenIdx] = useState<Set<number>>(new Set());

  const toggleSegment = (i: number) => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.toggleDataVisibility(i);
    chart.update();
    setHiddenIdx(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.canvasBox}>
        <Doughnut
          ref={chartRef}
          data={{
            labels,
            datasets: [{ data, backgroundColor: colors, borderWidth: 0 }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 700, easing: 'easeInOutQuart' },
            onClick: onSliceClick
              ? (_e, elements) => {
                  const i = elements[0]?.index;
                  if (i != null && labels[i] != null) onSliceClick(i, labels[i]);
                }
              : undefined,
            onHover: onSliceClick
              ? (_e, elements, chart) => {
                  (chart.canvas as HTMLCanvasElement).style.cursor = elements.length ? 'pointer' : 'default';
                }
              : undefined,
            // 얇은 세그먼트의 % 라벨이 캔버스 밖으로 나가 잘리지 않도록 여백 확보 (ChartCard가 overflow:hidden)
            layout: { padding: 12 },
            plugins: {
              // 범례는 아래 2열 그리드로 직접 그린다 (Chart.js 기본 범례는 개수에 따라 줄이 어긋남)
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.label}: ${(ctx.parsed as number).toFixed(1)}억원`,
                },
              },
              datalabels: {
                display: showLabels,
                color:   (ctx) => arcTextColor((ctx.dataset.backgroundColor as string[])[ctx.dataIndex]),
                font:    { size: 12, weight: 'bold' },
                textAlign: 'center',
                formatter: (value: number, ctx) => {
                  const sum = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                  if (!sum || value === 0) return '';
                  return `${((value / sum) * 100).toFixed(1)}%`;
                },
              },
            },
          }}
        />
      </div>

      {labels.length > 0 && (
        <ul className={styles.legend}>
          {labels.map((label, i) => (
            <li key={label}>
              <Button
                unstyled
                className={`${styles.item} ${hiddenIdx.has(i) ? styles.itemHidden : ''}`}
                onClick={() => toggleSegment(i)}
                aria-pressed={!hiddenIdx.has(i)}
                title={`${label} ${hiddenIdx.has(i) ? '표시' : '숨기기'}`}
              >
                <i className={styles.dot} style={{ background: (colors[i] ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]) }} />
                <span className={styles.name} title={label}>{label}</span>
                <span className={styles.pct}>
                  {total > 0 ? ((data[i] / total) * 100).toFixed(1) : '0.0'}%
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DoughnutChart;
