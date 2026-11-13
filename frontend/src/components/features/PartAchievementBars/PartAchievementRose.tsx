import { useMemo } from 'react';
import { PolarArea } from 'react-chartjs-2';
import { Chart, RadialLinearScale, ArcElement, Tooltip } from 'chart.js';
import type { ChartOptions, Plugin } from 'chart.js';
import type { PerfPartRow } from '@/hooks/viewmodels/usePerformanceViewModel';
import { stripPartPrefix } from '@/utils';
import { sortByPart } from '@/utils/partOrder';
import { prefersReducedMotion } from '@/utils/format';
import { getChartTheme } from '@/utils/chartColors';
// datalabels 등록 + "그래프 수치" 토글 페이드 (side-effect)
import '@/utils/datalabelFade';
import '@/utils/chartCrisp';   // 배율 125% 등에서 캔버스 글씨 번짐 방지 (side-effect)
import styles from './PartAchievementBars.module.css';

Chart.register(RadialLinearScale, ArcElement, Tooltip);

interface Props {
  rows: PerfPartRow[];
  /** 주간/야간 색 — 기본은 야간(처음엔 야간 전용으로 만들었고, 2026-11-06 카드 토글로 주간에서도 고를 수 있게 됨) */
  dark?: boolean;
  /** 파트 꽃잎 클릭 — 드릴다운 모달 열기. 전달 값은 접두 원문자 제거된 파트명(막대 버전과 같음) */
  onPartClick?: (part: string) => void;
}

/**
 * "파트별 매출 실적 진행 현황" 장미(폴라) 차트(2026-11-06 요청) — 카드 왼쪽 아래 토글(PartAchievementChart)로 기존 막대와 번갈아 봄.
 * 꽃잎 길이 = 달성률(누계 매출 ÷ 연간 추정 매출), 색 = 막대 버전과 같은 구간(범례 PartAchievementLegend 공용 — 테마의 --loss/--warn/--profit과 같은 값).
 * 30·60·100% 기준은 막대의 점선 경계선과 같은 역할로 동심원 점선(수치는 꽃잎에 가려지지 않게 카드 배경색 알약 위에).
 * 이름·수치 라벨은 꽃잎 끝이 아니라 가장 바깥 눈금 밖 고정 반경에 — 점선과 글자가 겹치지 않게.
 */
interface RoseTheme {
  bands:   { min: number; color: string }[];   // 달성률 구간 색(낮은 구간부터)
  surface: string;   // 카드 배경(--surface) — 꽃잎 사이 틈·알약 바탕
  ring:    string;   // 동심원 점선
  pillBg:  string;
  pillBorder: string;
  pillText:   string;
}
const THEMES: Record<'dark' | 'light', RoseTheme> = {
  dark: {
    bands: [
      { min: -Infinity, color: 'rgba(255,106,77,0.88)' },   // --loss (다크)
      { min: 30,        color: 'rgba(199,148,113,0.88)' },  // --warn (다크, Gold tint)
      { min: 60,        color: 'rgba(0,170,210,0.88)' },    // Active Blue
      { min: 100,       color: 'rgba(170,202,230,0.92)' },  // --profit (다크, Sky Blue)
    ],
    surface: '#0E2038',
    ring: 'rgba(228,220,211,0.5)',
    pillBg: 'rgba(14,32,56,0.92)', pillBorder: 'rgba(228,220,211,0.45)', pillText: 'rgba(228,220,211,0.98)',
  },
  light: {
    bands: [
      { min: -Infinity, color: 'rgba(230,51,18,0.9)' },     // --loss
      { min: 30,        color: 'rgba(163,107,79,0.9)' },    // --warn (Hyundai Gold)
      { min: 60,        color: 'rgba(0,170,210,0.9)' },     // Active Blue
      { min: 100,       color: 'rgba(0,44,95,0.92)' },      // --profit (Hyundai Blue)
    ],
    surface: '#FFFFFF',
    ring: 'rgba(0,44,95,0.4)',
    pillBg: 'rgba(255,255,255,0.95)', pillBorder: 'rgba(0,44,95,0.3)', pillText: '#002C5F',
  },
};
const bandColor = (t: RoseTheme, rate: number) => t.bands.reduce((acc, b) => (rate >= b.min ? b : acc), t.bands[0]).color;

const RINGS = [30, 60, 100];
// 파트가 적을 때(1~2개) 꽃잎이 원 전체·반원이 되어 어색하므로 최소 6칸으로 잡고 빈 칸은 비움 — 파트는 칸에 고르게 흩어 배치
const MIN_SLOTS = 6;
const LABEL_GAP = 10;   // 가장 바깥 눈금과 라벨 사이 간격(px)
// 긴 파트명(7자 이상, 가운뎃점 있음)은 점 자리에서 두 줄로 — 좌우 라벨이 캔버스 끝에서 잘리지 않게(가로 막대 차트의 breakAtDotTick과 같은 규칙)
const breakName = (name: string) => (name.length >= 7 && name.includes('ㆍ') ? name.replace('ㆍ', 'ㆍ\n') : name);
// 글씨가 작고 가늘어 흐릿하다는 지적(2026-11-10) — 막대 차트 데이터 라벨(12px 볼드, chartTuning LABEL_FAMILY)과 같게. 기준 알약 글씨도 9px 600 → 10px 볼드
const LABEL_FAMILY = "'Pretendard', 'Malgun Gothic', sans-serif";
const FONT = `700 10px ${LABEL_FAMILY}`;

// 기준 동심원(30/60/100%) — 꽃잎 위에 점선으로, 수치는 맨 위(12시)에 알약으로. 테마별로 한 번씩만 만들어 둠
// (react-chartjs-2의 plugins prop은 차트를 처음 만들 때만 읽어서, 테마가 바뀌면 key로 차트를 새로 만든다)
const makeRingsPlugin = (t: RoseTheme): Plugin<'polarArea'> => ({
  id: 'achieveRings',
  afterDatasetsDraw(chart) {
    const r = chart.scales.r as RadialLinearScale | undefined;
    if (!r) return;
    const { ctx } = chart;
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = t.ring;
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const v of RINGS) {
      const d = r.getDistanceFromCenterForValue(v);
      ctx.beginPath();
      ctx.arc(r.xCenter, r.yCenter, d, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 기준 수치는 점선 위(12시)에 놓이는데 꽃잎·점선 위에선 회색 글자가 묻혀 안 보였음 → 카드 배경색 알약을 깔고 진한 글자로
    ctx.setLineDash([]);
    for (const v of RINGS) {
      const d = r.getDistanceFromCenterForValue(v);
      const text = `${v}%`;
      const w = ctx.measureText(text).width + 8;
      const h = 15;
      const x = r.xCenter - w / 2;
      const y = r.yCenter - d - h / 2;
      ctx.fillStyle = t.pillBg;
      ctx.strokeStyle = t.pillBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, h / 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = t.pillText;
      ctx.fillText(text, r.xCenter, y + h / 2 + 0.5);
    }
    ctx.restore();
  },
});
const RINGS_PLUGIN = { dark: makeRingsPlugin(THEMES.dark), light: makeRingsPlugin(THEMES.light) };

const PartAchievementRose = ({ rows, dark = true, onPartClick }: Props) => {
  const theme = THEMES[dark ? 'dark' : 'light'];
  const sorted = useMemo(() => sortByPart(rows, r => r.part), [rows]);
  // 칸(slot) 배열 — 파트가 MIN_SLOTS보다 적으면 floor(i × 칸수 ÷ 파트수) 자리에 놓고 나머지는 null(꽃잎·라벨 없음)
  const slots = useMemo(() => {
    const total = Math.max(sorted.length, MIN_SLOTS);
    const out: (PerfPartRow | null)[] = Array.from({ length: total }, () => null);
    sorted.forEach((row, i) => { out[Math.floor((i * total) / sorted.length)] = row; });
    return out;
  }, [sorted]);
  const labels = useMemo(() => slots.map(r => (r ? stripPartPrefix(r.part) : '')), [slots]);
  const rates  = useMemo(() => slots.map(r => (r ? r.achieveRateNum : null)), [slots]);
  // 100%를 넘는 파트가 있으면 바깥 눈금을 10% 단위로 늘려 꽃잎이 잘리지 않게
  const rMax   = useMemo(() => Math.max(100, Math.ceil(Math.max(0, ...rates.map(v => v ?? 0)) / 10) * 10), [rates]);

  const { labelColor } = getChartTheme(dark);

  const data = useMemo(() => ({
    labels,
    datasets: [{
      data: rates,
      backgroundColor: rates.map(v => (v == null ? 'transparent' : bandColor(theme, v))),
      borderColor: theme.surface,
      borderWidth: 2,
      hoverBorderColor: theme.surface,
      hoverBorderWidth: 2,
    }],
  }), [labels, rates, theme]);

  const options = useMemo<ChartOptions<'polarArea'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: prefersReducedMotion() ? false : { duration: 600 },
    layout: { padding: { top: 40, bottom: 40, left: 84, right: 84 } },   // 바깥 이름·수치 라벨 자리(눈금 밖에 놓으므로 넉넉히)
    scales: {
      r: {
        min: 0,
        max: rMax,
        ticks: { display: false },
        grid: { display: false },
        angleLines: { display: false },
        pointLabels: { display: false },
        border: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: items => labels[items[0]?.dataIndex ?? 0] ?? '',
          label: item => {
            const row = slots[item.dataIndex];
            return row
              ? `달성률 ${row.achieveRateNum.toFixed(1)}%  (${row.junActualNum.toFixed(1)}억 / ${row.junCheckTotalNum.toFixed(1)}억)`
              : '';
          },
        },
      },
      datalabels: {
        anchor: 'end',
        align: 'end',
        // 라벨은 꽃잎 끝이 아니라 가장 바깥 눈금(rMax) 밖 고정 반경에 — 꽃잎이 100% 근처일 때 점선과 글자가 겹치던 것
        offset: (ctx: { chart: Chart; dataIndex: number }) => {
          const r = ctx.chart.scales.r as RadialLinearScale | undefined;
          const v = rates[ctx.dataIndex];
          if (!r || v == null) return LABEL_GAP;
          return r.getDistanceFromCenterForValue(rMax) - r.getDistanceFromCenterForValue(v) + LABEL_GAP;
        },
        clamp: false,
        textAlign: 'center',
        color: labelColor,
        font: { size: 12, weight: 'bold', family: LABEL_FAMILY },
        display: (ctx: { dataIndex: number }) => slots[ctx.dataIndex] != null,
        formatter: (v: number | null, ctx: { dataIndex: number }) => (v == null ? '' : `${breakName(labels[ctx.dataIndex])}\n${v.toFixed(0)}%`),
      },
    } as ChartOptions<'polarArea'>['plugins'],
    onClick: (_e, elements) => {
      const el = elements[0];
      if (el && onPartClick && slots[el.index]) onPartClick(labels[el.index]);
    },
    onHover: (event, elements) => {
      const canvas = event.native?.target as HTMLCanvasElement | undefined;
      if (canvas && onPartClick) canvas.style.cursor = elements.some(el => slots[el.index]) ? 'pointer' : 'default';
    },
  }), [labels, slots, rMax, labelColor, onPartClick]);

  return (
    <div className={styles.rose}>
      <PolarArea key={dark ? 'dark' : 'light'} data={data} options={options} plugins={[RINGS_PLUGIN[dark ? 'dark' : 'light']]} />
    </div>
  );
};

export default PartAchievementRose;
