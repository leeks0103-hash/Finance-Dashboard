import { useRef, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import { Button } from '@/components/ui/Button';
import { outsideLabelsPlugin } from '@/components/ui/Chart/outsideLabelsPlugin';
import '@/utils/datalabelFade';   // datalabels 플러그인 등록 (side-effect)
import styles from './BigCostDoughnut.module.css';

Chart.register(ArcElement, Tooltip, Legend);

interface Props {
  labels:       string[];
  data:         number[];
  colors:       string[];
  showLabels:   boolean;
  onSliceClick: (index: number, label: string) => void;
}

/**
 * 원가 비율 확대 모달 왼쪽 전용 큰 도넛 — components/ui/Chart/DoughnutChart 와
 * 완전히 독립된 컴포넌트(별도 CSS 모듈). 여기 크기·여백을 조정해도 메인 화면
 * 원가비율 카드에는 절대 영향을 주지 않는다 (그 반대도 마찬가지).
 */
const BigCostDoughnut = ({ labels, data, colors, showLabels, onSliceClick }: Props) => {
  const total = data.reduce((a, b) => a + b, 0);

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
          plugins={[outsideLabelsPlugin]}
          data={{ labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 700, easing: 'easeInOutQuart' },
            onClick: (_e, elements) => {
              const i = elements[0]?.index;
              if (i != null && labels[i] != null) onSliceClick(i, labels[i]);
            },
            onHover: (_e, elements, chart) => {
              (chart.canvas as HTMLCanvasElement).style.cursor = elements.length ? 'pointer' : 'default';
            },
            layout: { padding: 68 },   // 인출선(+25) + "100.0%" 텍스트 폭까지 감안한 여백
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: { label: (ctx) => `${ctx.label}: ${(ctx.parsed as number).toFixed(1)}억원` },
              },
              datalabels: { display: false },   // 인출선 플러그인이 라벨을 대신 그림
              outsideLabels: { enabled: showLabels, size: 'lg' },
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
                <i className={styles.dot} style={{ background: colors[i] }} />
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

export default BigCostDoughnut;
