import { prefersReducedMotion } from '@/utils/format';
import { useRef, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import { Button } from '@/components/ui/Button';
// datalabels 등록 + "그래프 수치" 토글 켜기/끄기 페이드 (side-effect)
import '@/utils/datalabelFade';
import '@/utils/chartCrisp';   // 배율 125% 등에서 캔버스 글씨 번짐 방지 (side-effect)
import { outsideLabelsPlugin, outsideLabelSidePadding } from './outsideLabelsPlugin';
import styles from './DoughnutChart.module.css';

Chart.register(ArcElement, Tooltip, Legend);

interface Props {
  labels:       string[];
  data:         number[];
  colors?:      string[];
  showLabels?:  boolean;
  /** 세그먼트(또는 범례 항목) 클릭 — 인덱스와 라벨. 지정 시 조각 위 커서가 포인터로 바뀐다 */
  onSliceClick?: (index: number, label: string) => void;
  /** true면 라벨을 링 안쪽 대신 바깥 인출선으로 표시 — 조각이 얇아 숫자가 안 보일 때용.
   *  메인 카드·확대(큰 화면) 그래프에서만 켜고, 작은 미리보기 카드에는 켜지 않는다. */
  outsideLabels?: boolean;
  /** 'sm'(기본) — 메인 카드처럼 캔버스가 작아 인출선을 짧게(링 크기 거의 그대로).
   *  'lg' — 확대 모달처럼 캔버스가 큰 곳 전용. 두 값은 완전히 독립 — 하나를 조정해도 다른 쪽엔 영향 없음. */
  outsideLabelsSize?: 'sm' | 'md' | 'lg';
  /** true면 인출선 라벨을 "경상손익(5.7%)"처럼 항목명과 함께 — 가로가 넓은 카드용. 좌우 여백도 가장 긴 이름 폭으로 잡음 */
  outsideLabelNames?: boolean;
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
  outsideLabels = false,
  outsideLabelsSize = 'sm',
  outsideLabelNames = false,
}: Props) => {
  const total = data.reduce((a, b) => a + b, 0);
  // md 크기의 좌우 여백 — 항목명을 같이 쓰면 가장 긴 이름 폭만큼 더 필요
  const sidePad = outsideLabelSidePadding('md', outsideLabelNames ? labels : undefined);

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
          plugins={[outsideLabelsPlugin]}
          data={{
            labels,
            datasets: [{ data, backgroundColor: colors, borderWidth: 0 }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: prefersReducedMotion() ? 0 : 700, easing: 'easeInOutQuart' },
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
            // sm(메인 카드): 링 크기 거의 그대로(12→20px). lg(확대 모달): 인출선·글자가 커서 여백도 크게(64px)
            // md(메인 카드): 위아래 28, 좌우는 라벨 폭을 재서 — 3칸 카드에서 좌우 라벨이 잘리던 것(2026-10-21)
            layout: { padding: !outsideLabels ? 12
              : outsideLabelsSize === 'lg' ? 68
              : outsideLabelsSize === 'md' ? { top: 28, bottom: 28, left: sidePad, right: sidePad }
              : 24 },
            plugins: {
              // 범례는 아래 2열 그리드로 직접 그린다 (Chart.js 기본 범례는 개수에 따라 줄이 어긋남)
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.label}: ${(ctx.parsed as number).toFixed(1)}억원`,
                },
              },
              // outsideLabels 모드에선 인출선 플러그인이 라벨을 그리므로 링 안쪽 기본 라벨은 끔
              datalabels: {
                display: showLabels && !outsideLabels,
                color:   (ctx) => arcTextColor((ctx.dataset.backgroundColor as string[])[ctx.dataIndex]),
                font:    { size: 13, weight: 'bold' },
                textAlign: 'center',
                formatter: (value: number, ctx) => {
                  const sum = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                  if (!sum || value === 0) return '';
                  return `${((value / sum) * 100).toFixed(1)}%`;
                },
              },
              outsideLabels: { enabled: showLabels && outsideLabels, size: outsideLabelsSize, showName: outsideLabelNames },
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
