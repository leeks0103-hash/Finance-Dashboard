import { useChartPalette } from '@/hooks/useChartPalette';
import type { ChartColorOverrides } from '@/utils/chartColors';
import styles from './ChartColorPreview.module.css';

/** 차트 색상 모달 위쪽 미리보기 — 고른 색을 실제 차트 모양(막대·계획선·손실·도넛)으로 바로 보여 줌.
 *  Chart.js 대신 SVG로 가볍게 그림. 값은 모양만 보이는 가짜 숫자 */
const BARS = [
  { name: 'A파트', plan: 62, rev: 70, cost: 48, loss: false },
  { name: 'B파트', plan: 80, rev: 66, cost: 74, loss: true },
  { name: 'C파트', plan: 45, rev: 52, cost: 30, loss: false },
];
const RATES = [12, -6, 18, 7];
const DONUT = [0.55, 0.2, 0.13, 0.12];

const H = 92;              // 막대 영역 높이
const BW = 13;             // 막대 폭
const GROUP_W = BW * 3 + 18;

const arc = (start: number, end: number, r: number, R: number) => {
  const p = (t: number, rad: number) => {
    const a = t * 2 * Math.PI - Math.PI / 2;
    return `${50 + rad * Math.cos(a)} ${50 + rad * Math.sin(a)}`;
  };
  const large = end - start > 0.5 ? 1 : 0;
  return `M ${p(start, R)} A ${R} ${R} 0 ${large} 1 ${p(end, R)} L ${p(end, r)} A ${r} ${r} 0 ${large} 0 ${p(start, r)} Z`;
};

/** overrides — 저장 전 선택(모달 draft). 미리보기는 저장 안 해도 바로 바뀜 */
const ChartColorPreview = ({ overrides }: { overrides?: ChartColorOverrides }) => {
  const c = useChartPalette(overrides);
  const donutColors = [c.costDirect, c.costLabor, c.costOverhead, c.costMgmt];
  let acc = 0;

  return (
    <div className={styles.root} aria-label="차트 색상 미리보기">
      <figure className={styles.card}>
        <figcaption>계획 · 매출 · 원가(손실)</figcaption>
        <svg viewBox={`0 0 ${GROUP_W * BARS.length} ${H + 14}`} className={styles.svg}>
          {BARS.map((b, i) => {
            const x = i * GROUP_W + 6;
            const y = (v: number) => H - v;
            return (
              <g key={b.name}>
                <rect x={x}            y={y(b.plan)} width={BW} height={b.plan} fill={c.plan} />
                <rect x={x + BW + 2}   y={y(b.rev)}  width={BW} height={b.rev}  fill={c.revenue} />
                <rect x={x + 2*BW + 4} y={y(b.cost)} width={BW} height={b.cost} fill={b.loss ? c.loss : c.cost} />
                {/* 계획선(확대 모달의 매출·원가 계획 점선) */}
                <line x1={x + BW} x2={x + 2*BW + 4} y1={y(b.plan + 6)} y2={y(b.plan + 6)} stroke={c.planRevenue} strokeWidth="2" strokeDasharray="4 3" />
                <line x1={x + 2*BW + 2} x2={x + 3*BW + 6} y1={y(b.cost - 10)} y2={y(b.cost - 10)} stroke={c.planCost} strokeWidth="2" strokeDasharray="2 2" />
                <text x={x + BW / 2} y={y(b.plan) - 3} className={styles.num} fill={c.planLabel}>{b.plan}</text>
                <text x={x + 1.5 * BW + 2} y={H + 11} className={styles.axis}>{b.name}</text>
              </g>
            );
          })}
        </svg>
      </figure>

      <figure className={styles.card}>
        <figcaption>이익율 (이익 / 손실)</figcaption>
        <svg viewBox="0 0 100 106" className={styles.svg}>
          <line x1="0" x2="100" y1="60" y2="60" className={styles.base} />
          {RATES.map((r, i) => (
            <rect key={i} x={8 + i * 23} width="14"
              y={r >= 0 ? 60 - r * 2.6 : 60} height={Math.abs(r) * 2.6}
              fill={r >= 0 ? c.profit : c.loss} />
          ))}
        </svg>
      </figure>

      <figure className={styles.card}>
        <figcaption>원가 비율</figcaption>
        <svg viewBox="0 0 100 100" className={styles.svg}>
          {DONUT.map((v, i) => {
            const d = arc(acc, acc + v, 26, 44);
            acc += v;
            return <path key={i} d={d} fill={donutColors[i]} />;
          })}
        </svg>
      </figure>
    </div>
  );
};

export default ChartColorPreview;
