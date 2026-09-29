import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import { Button } from '@/components/ui/Button';
import { outsideLabelsPlugin, formatOutsideLabel, computeOutsideLabelPadding } from '@/components/ui/Chart/outsideLabelsPlugin';
import '@/utils/datalabelFade';   // datalabels 플러그인 등록 (side-effect)
import styles from './BigCostDoughnut.module.css';

Chart.register(ArcElement, Tooltip, Legend);

interface Props {
  labels:       string[];
  data:         number[];
  colors:       string[];
  showLabels:   boolean;
  /** 없으면 조각 클릭·포인터 커서 없음 — 오른쪽 확대 미리보기처럼 드릴다운이 없는 곳 */
  onSliceClick?: (index: number, label: string) => void;
  /** true면 인출선·범례에 금액도 같이 — "123.4억(45.2%)" */
  showValue?: boolean;
  /** 도넛(캔버스+범례) 오른쪽에 붙일 내용(비교표 등) — 범례는 도넛 폭 그대로, aside는 범례 끝까지 세로로 */
  aside?: ReactNode;
}

/**
 * 원가 비율 확대 모달 왼쪽 전용 큰 도넛 — components/ui/Chart/DoughnutChart 와
 * 완전히 독립된 컴포넌트(별도 CSS 모듈). 여기 크기·여백을 조정해도 메인 화면
 * 원가비율 카드에는 절대 영향을 주지 않는다 (그 반대도 마찬가지).
 */
const BigCostDoughnut = ({ labels, data, colors, showLabels, onSliceClick, showValue = false, aside }: Props) => {
  const total = data.reduce((a, b) => a + b, 0);
  // 인출선(+r2+horiz) + 실제 라벨 텍스트 폭 — showValue면 값 크기에 따라 길이가 달라 매번 실측
  const padding = useMemo(() => computeOutsideLabelPadding(data, total, showValue, 'lg'), [data, total, showValue]);

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
      <div className={styles.canvasRow}>
      <div className={styles.chartCol}>
      <div className={styles.canvasBox}>
        <Doughnut
          ref={chartRef}
          plugins={[outsideLabelsPlugin]}
          data={{ labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] }}
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
            // 금액 라벨은 좌우로만 길어지므로 좌우만 실측 여백, 위아래는 68 — 링이 캔버스 한가운데
            layout: { padding: { left: padding, right: padding, top: 68, bottom: 68 } },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: { label: (ctx) => `${ctx.label}: ${(ctx.parsed as number).toFixed(1)}억원` },
              },
              datalabels: { display: false },   // 인출선 플러그인이 라벨을 대신 그림
              outsideLabels: { enabled: showLabels, size: 'lg', showValue },
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
                <span className={styles.pct}>{formatOutsideLabel(data[i], total, showValue)}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      </div>
      {aside}
      </div>
    </div>
  );
};

export default BigCostDoughnut;
