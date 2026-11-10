import { useEffect, useId, useRef, useState } from 'react';
import styles from './CostDumbbell.module.css';

export interface DumbbellRow {
  part:     string;
  /** 연간 추정 매출(억) */
  revenue:  number;
  /** 직접원가(억) — 원가행 합 */
  direct:   number;
  /** 공통원가(억) — 매출행 합 */
  overhead: number;
}

export interface DumbbellColors {
  revenue:  string;
  direct:   string;
  overhead: string;
  /** 공통원가 **글자** 색 — 막대·캡슐 색(회청색)은 흰 배경 글씨로는 연해서 같은 계열의 진한 톤(없으면 overhead 그대로) */
  overheadText?: string;
  gain:     string;
  /** 이익 **글자** 색 — 선·범례 초록은 흰 배경 글씨로는 연해서 같은 계열의 진한 톤(없으면 gain 그대로) */
  gainText?: string;
  loss:     string;
  /** 원가율 글자 — 막대 차트의 원가율 글씨와 같은 색(Active Blue 계열). 이익(초록)과 구분 */
  rate:     string;
  /** 파트명·숫자 보조 글자 */
  label:    string;
  tick:     string;
  /** 파트명(축) 글자색 — 막대 차트 x축 파트명과 같게(다크는 흰색, 라이트는 tick). 없으면 label */
  name?:    string;
  grid:     string;
}

interface Props {
  rows:      DumbbellRow[];
  colors:    DumbbellColors;
  /** 그래프 수치(G 토글) — false면 숫자 글씨는 빼고 점·캡슐·선만 */
  showLabels?: boolean;
  /** 파트명 클릭 -1(파트 숨김/복원) · 매출 점 0 · 직접원가 1 · 공통원가 2 — 막대 차트의 datasetIndex와 같은 뜻(드릴다운 재사용) */
  onSelect?: (part: string, datasetIndex: number) => void;
}

const TOP = 8;
const AXIS_H = 30;
/** 축(파트명·눈금) 글꼴 — 막대 차트의 축과 같게: Chart.js 기본(Pretendard 14px, 보통 굵기, 크기는 행 크기와 무관하게 고정)(2026-11-10 요청) */
const AXIS_FONT_PX = 14;
const FONT_FAMILY = "'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";
const ROW_MIN = 52;
const ROW_MAX = 64;
/** 파트가 적을수록 행을 더 키움 — 행이 적을 때 작은 그림이 위쪽에 덩그러니 남던 것(2026-11-10). 파트 수 → 행 최대 높이 */
const rowMaxFor = (n: number) => (n <= 1 ? 180 : n <= 2 ? 140 : n <= 3 ? 108 : n <= 4 ? 86 : ROW_MAX);
const CAP_W = 58;      // 총원가 끝 캡슐 폭(고정 — 직접:공통 비율로 두 색을 나누되 공통원가는 최소 폭 보장, 축 눈금과는 무관)
const OVH_MIN_W = 4;   // 공통원가 조각 최소 폭(px) — 비율대로면 1~2px 선이 되어 안 보임. 너무 크게 잡으면(10px) 모든 파트가 최소 폭에 걸려 비율이 다 같아 보였음 → 캡슐을 넓히고 최소 폭은 작게(2026-11-10)
const CAP_H = 16;
const DOT_R = 8;
const STEPS = [5, 10, 20, 25, 50, 100, 200, 250, 500];

const f1 = (v: number) => v.toFixed(1);   // 항상 소수 첫째 자리 — "29"·"6.1"처럼 들쭉날쭉하면 더하기 확인이 어려움
const fmtGap = (g: number) => (g >= 0 ? `+${f1(g)}` : `−${f1(Math.abs(g))}`);
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
/** 좌표·글자 크기는 정수로 — SVG는 소수 좌표(특히 글씨)를 반 픽셀에 걸쳐 그려서 막대(캔버스)보다 글씨가 흐릿해 보였음(2026-11-10) */
const q = Math.round;
/** 짝수로 — 가운데 y를 정수에 두면 위아래가 정수 픽셀에 떨어져 가장자리가 또렷함 */
const even = (v: number) => 2 * Math.round(v / 2);

/** 눈금 간격 — 눈금이 5개 안팎이 되는 가장 작은 간격 */
const niceTicks = (maxVal: number): number[] => {
  const step = STEPS.find(s => maxVal / s <= 4.2) ?? STEPS[STEPS.length - 1];
  const top = Math.max(step, Math.ceil(maxVal / step) * step);
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
};

/** 안쪽 글씨(수식·매출·이익/원가율)는 막대 차트의 데이터 라벨처럼 **전부 볼드**, 축(파트명·눈금)은 막대 차트 축처럼 보통 굵기 — 굵기가 섞여 보이는 게 아니라 이 구분(2026-11-10). 볼드를 뺐더니 흐려 보인다는 지적 */
/**
 * "원가분석(파트별 추정 매출/원가)"의 덤벨 보기(2026-11-10) — 파트마다 한 줄:
 *   왼쪽 끝 캡슐 = 총원가(직접원가·공통원가 두 색, 비율대로) + 위에 "(직접 + 공통) = 총원가"
 *   오른쪽 점 = 매출 · 두 점 사이 굵은 선 = 이익(원가가 매출을 넘으면 손실색) + 아래에 "이익 +N · 원가율 N%"
 * 막대 차트와 같은 값·같은 색 역할(매출·직접원가·공통원가·손실) + 이익은 새 역할 gain(초록). 순수 표현 컴포넌트 — 값은 억 단위 숫자로 받음
 */
const CostDumbbell = ({ rows, colors, showLabels = true, onSelect }: Props) => {
  const uid = useId().replace(/:/g, '');
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 560, h: 400 });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0) setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = rows.length;
  const rowH = Math.floor(clamp((size.h - TOP - AXIS_H) / Math.max(n, 1), ROW_MIN, rowMaxFor(n)));
  // 행이 커지면 점·캡슐·선·글자도 같이 키움(최대 1.7배) — 행만 늘리면 빈 공간만 커져 볼품이 없었음
  const k = clamp(rowH / 58, 1, 1.7);
  const dotR = q(DOT_R * k), capW = even(CAP_W * k), capH = even(CAP_H * k);
  // 그래프 안쪽 글씨는 모양(점·캡슐·선)보다 덜 키움 — 같이 1.7배로 키우면 14px 고정인 축 글씨와 어울리지 않았음(2026-11-10)
  const fs = (base: number) => q(base * (1 + (k - 1) * 0.35));   // 정수 px
  const plotH = rowH * n;
  const svgH = TOP + plotH + AXIS_H;
  // 가운데 정렬은 flex가 아니라 정수 여백으로 — flex 가운데는 높이가 홀수일 때 SVG 전체를 반 픽셀에 걸치게 해 글씨가 흐려짐
  const padTop = Math.max(0, Math.floor((size.h - svgH) / 2));

  const maxVal = Math.max(1, ...rows.flatMap(r => [r.revenue, r.direct + r.overhead]));
  const ticks = niceTicks(maxVal);
  const axisMax = ticks[ticks.length - 1];
  const L = clamp(Math.max(0, ...rows.map(r => r.part.length)) * AXIS_FONT_PX + 24, 64, 200);
  const R = showLabels ? 62 * k : 16;
  const plotW = Math.max(size.w - L - R, 80);
  const x = (v: number) => q(L + (plotW * v) / axisMax);

  return (
    <div className={styles.wrap}>
      <div ref={ref} className={styles.plot} style={{ paddingTop: padTop }}>
      <svg className={styles.svg} width={size.w} height={svgH} style={{ fontFamily: FONT_FAMILY }} role="img"
        aria-label="파트별 추정 매출과 원가(직접원가·공통원가)의 차이를 보여 주는 덤벨 차트">
        {ticks.map(t => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={TOP} y2={TOP + plotH} stroke={colors.grid} />
            <text x={x(t)} y={TOP + plotH + 20} textAnchor="middle" style={{ fontSize: AXIS_FONT_PX }} fill={colors.tick}>{t}억</text>
          </g>
        ))}

        {rows.map((r, i) => {
          const cost = r.direct + r.overhead;
          const gap = r.revenue - cost;
          const loss = gap < 0;
          const yc = TOP + rowH * i + q(rowH / 2) + 3;
          const cx = x(cost);
          const rx = x(r.revenue);
          const share = cost > 0 ? r.direct / cost : 1;
          const capX = q(cx - capW / 2);
          // 공통원가 조각: 비율대로 그리되 아주 작아도 보이게 최소 폭(캡슐의 45%까지) — 두 색 비율은 "보기용"(정확한 값은 수식 라벨·툴팁)
          const ovhW = r.overhead > 0 ? Math.min(Math.max(q(capW * (1 - share)), q(OVH_MIN_W * k)), q(capW * 0.45)) : 0;
          const split = capW - ovhW;
          const capId = `cap-${uid}-${i}`;
          const ratio = r.revenue > 0 ? `${(cost / r.revenue * 100).toFixed(1)}%` : '-';
          const lineColor = loss ? colors.loss : colors.gain;
          const gapTextColor = loss ? colors.loss : (colors.gainText ?? colors.gain);
          const tip = [
            r.part,
            `매출 ${f1(r.revenue)}억`,
            `직접원가 ${f1(r.direct)}억 + 공통원가 ${f1(r.overhead)}억 = 총원가 ${f1(cost)}억`,
            '(캡슐의 두 색은 직접:공통 비율 — 공통원가는 작아도 보이게 최소 폭)',
            `${loss ? '손실' : '이익'} ${fmtGap(gap)}억 (매출 − 총원가)`,
            `원가율 ${ratio}`,
          ].join('\n');
          return (
            <g key={r.part} data-testid="dumbbell-row">
              <title>{tip}</title>
              <text x={L - 10} y={yc + 5} textAnchor="end" className={onSelect ? styles.clickable : undefined}
                style={{ fontSize: AXIS_FONT_PX }} fill={colors.name ?? colors.label} onClick={() => onSelect?.(r.part, -1)}>{r.part}</text>

              <line x1={Math.min(cx, rx)} x2={Math.max(cx, rx)} y1={yc} y2={yc} stroke={lineColor}
                strokeWidth={even(8 * k)} strokeLinecap="round" data-testid="dumbbell-gap" />

              <clipPath id={capId}><rect x={capX} y={yc - capH / 2} width={capW} height={capH} rx={capH / 2} /></clipPath>
              <g clipPath={`url(#${capId})`} className={onSelect ? styles.clickable : undefined}>
                <rect x={capX} y={yc - capH / 2} width={split} height={capH} fill={colors.direct}
                  onClick={() => onSelect?.(r.part, 1)} />
                <rect x={capX + split} y={yc - capH / 2} width={capW - split} height={capH} fill={colors.overhead}
                  onClick={() => onSelect?.(r.part, 2)} />
                {ovhW > 0 && <line x1={capX + split} x2={capX + split} y1={yc - capH / 2} y2={yc + capH / 2} strokeWidth={2} style={{ stroke: 'var(--surface)' }} />}
              </g>

              <circle cx={rx} cy={yc} r={dotR} fill={colors.revenue} className={onSelect ? styles.clickable : undefined}
                onClick={() => onSelect?.(r.part, 0)} />

              {showLabels && (
                <>
                  <text x={q(clamp(cx, L + 72 * k, size.w - 72 * k))} y={yc - q(15 * k)} textAnchor="middle" className={styles.formula}
                    style={{ fontSize: fs(12), fontWeight: 700 }}>
                    <tspan fill={colors.label}>(</tspan>
                    <tspan fill={colors.direct}>{f1(r.direct)}</tspan>
                    <tspan fill={colors.label}> + </tspan>
                    <tspan fill={colors.overheadText ?? colors.overhead}>{f1(r.overhead)}</tspan>
                    <tspan fill={colors.label}>{`) = ${f1(cost)}`}</tspan>
                  </text>
                  <text x={q(Math.max(rx + dotR, cx + capW / 2)) + 6} y={yc + q(4 * k)} className={styles.revenue}
                    style={{ fontSize: fs(13), fontWeight: 700 }} fill={colors.revenue}>{f1(r.revenue)}</text>
                  {/* 이익(초록)·손실(빨강)과 원가율(막대 차트의 원가율 색)을 다른 글자색으로(2026-11-10 요청) */}
                  <text x={q(clamp((cx + rx) / 2, L + 94 * k, size.w - 94 * k))} y={yc + q(22 * k)} textAnchor="middle" className={styles.gap}
                    style={{ fontSize: fs(12), fontWeight: 700 }}>
                    <tspan fill={gapTextColor}>{`${loss ? '손실' : '이익'} ${fmtGap(gap)}`}</tspan>
                    <tspan fill={colors.label}>{' · '}</tspan>
                    <tspan fill={colors.rate}>{`원가율 ${ratio}`}</tspan>
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      </div>
      <div className={styles.legend} aria-hidden="true">
        <span><i style={{ background: colors.revenue }} />매출</span>
        <span><i style={{ background: colors.direct }} />직접원가</span>
        <span><i style={{ background: colors.overhead }} />공통원가</span>
        <span><i style={{ background: colors.gain }} />이익</span>
        <span><i style={{ background: colors.loss }} />손실</span>
      </div>
    </div>
  );
};

export default CostDumbbell;
