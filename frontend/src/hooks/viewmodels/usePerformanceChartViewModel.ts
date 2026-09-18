import { useCallback, useMemo, useState } from 'react';
import { usePerformanceSummary } from '@/hooks/usePerformanceSummary';
import { usePerformanceSummaryAll } from '@/hooks/usePerformanceSummaryAll';
import { usePerformanceOptions } from '@/hooks/usePerformanceData';
import { useUiStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { makeBarOptions } from '@/utils/chartOptions';
import { getChartTheme } from '@/utils/chartColors';
import { sortProgress } from '@/utils/progressOrder';
import { sortParts } from '@/utils/partOrder';
import { PERF_MONTH, stripPartPrefix } from '@/utils';
import type { ChartOptions } from 'chart.js';

// 천원 → 억원 — 표시 단위 변환(순수 포맷팅). undefined가 들어와 차트에 NaN이 찍히는 것만 방어한다.
const toEokNum = (v: number | null | undefined) =>
  Number.isFinite(Number(v)) ? +(Number(v) / 100_000).toFixed(1) : 0;

// PERF_MONTH("7월") 기준 — 이후 달은 아직 실적이 없는 추정 구간이므로 흐릿하게 표시
const CURRENT_MONTH_NUM = parseInt(PERF_MONTH, 10);
const isFutureMonth = (label: string) => parseInt(label, 10) > CURRENT_MONTH_NUM;

export interface PerformanceChartViewModel {
  isLoading:  boolean;
  isError:    boolean;
  isEmpty:    boolean;
  showLabels: boolean;
  labelColor: string;
  monthly: {
    labels:   string[];
    revenues: number[];
    costs:    number[];
    isFuture: boolean[];
    options:  ChartOptions<'bar'>;
  };
  planVsActual: {
    labels:        string[];
    planInitial:   number[];
    /** 연간 추정 실적(BE열) — 계획이 연간 기준이라 누계 실적(1~N월) 대신 같은 기간끼리 비교 */
    junCheckTotal: number[];
    options:     ChartOptions<'bar'>;
  };
  profitRate: {
    labels:   string[];
    rates:    number[];
    profits:  number[];
    isProfit: boolean[];
    // "파트별 추정 매출/원가" 카드용 — 연간 추정 매출/원가 2계열 (담당자 지정)
    revenues: number[];
    costs:    number[];
    // 목표선(시범) — 파트별 매출/원가 계획
    planRevenue: number[];
    planCost:    number[];
    options:  ChartOptions<'bar'>;
  };
  costBreakdown: {
    labels: string[];
    values: number[];
  };
  /** 팀 목록 — 원가 비율 카드 설정 패널의 "전체/팀/파트" 개별 선택용 */
  teams:            string[];
  selectedCostTeam: string;
  setSelectedCostTeam: (v: string) => void;
  /** "전체" + 접두어 뗀 파트명 목록 — 원가 비율 카드 파트 선택 드롭다운용 */
  partOptions:      string[];
  selectedCostPart: string;
  setSelectedCostPart: (v: string) => void;
  /** selectedCostPart의 원본 파트명(접두어 포함) — 드릴다운 breakdown 조회의 partOverride용 */
  selectedCostPartRaw?: string;
  progress: {
    labels:       string[];
    revenues:     number[];
    expenditures: number[];
    options:      ChartOptions<'bar'>;
  };
  /** 원가 비율 확대 모달(CostBreakdownModal)이 직접 쓰는 원본 구성비 데이터.
   *  로딩 중이거나 데이터가 없으면 null. */
  chartData: {
    costBreakdownTotal:  { labels: string[]; values: number[] };
    costBreakdownByPart: Record<string, { labels: string[]; values: number[] }>;
    costBreakdownByTeam: Record<string, { labels: string[]; values: number[] }>;
    partsRaw:            string[];
    teamParts:           Record<string, string[]>;
  } | null;
}

export const usePerformanceChartViewModel = (): PerformanceChartViewModel => {
  const { data: summary, isLoading, isError } = usePerformanceSummary();
  // "전체 평균 원가 비율" 카드만 메인 필터와 무관하게 항상 전체 데이터 기준
  const { data: summaryAll } = usePerformanceSummaryAll();
  const { data: options } = usePerformanceOptions();
  const showLabels = useUiStore(s => s.showChartLabels);
  const { theme } = useTheme();
  const { labelColor } = getChartTheme(theme === 'dark');

  // 전체 / 팀 / 파트 — 서로 배타적인 개별 선택지(팀을 펼쳐야 파트가 나오는 계단식 아님).
  // 하나를 고르면 다른 하나는 자동으로 '선택 없음'으로 리셋
  const [selectedCostPart, setSelectedCostPartRaw] = useState<string>('전체');
  const [selectedCostTeam, setSelectedCostTeamRaw] = useState<string>('');   // '' = 미선택

  const setSelectedCostTeam = useCallback((v: string) => {
    setSelectedCostTeamRaw(v);
    setSelectedCostPartRaw('전체');
  }, []);
  const setSelectedCostPart = useCallback((v: string) => {
    setSelectedCostPartRaw(v);
    setSelectedCostTeamRaw('');
  }, []);

  const teams     = useMemo(() => options?.teams ?? [], [options]);
  const teamParts = useMemo(() => options?.team_parts ?? {}, [options]);

  const monthlyLength = summary?.monthly.length ?? 12;

  const monthlyOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    // 세로 막대 + align:'end'(막대 위) — 최고값 막대의 수치가 캔버스 상단에 잘리지 않게 여백 확보
    layout: { padding: { top: 24 } },
    plugins: {
      datalabels: {
        anchor: 'end',
        align:  'end',
        display: (ctx: { chart: { width: number } }) =>
          showLabels && ctx.chart.width / (monthlyLength * 2) > 20,
        formatter: (v: number) => `${v}억`,
      },
    },
  }), [showLabels, labelColor, monthlyLength]);

  const planVsActualOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    layout: { padding: { right: 52 } },
    plugins: {
      datalabels: {
        anchor: 'end',
        align:  'end',
        formatter: (v: number) => `${v}억`,
      },
    },
  }), [showLabels, labelColor]);

  const profitRateOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    // bottom — 마이너스 막대는 수치가 막대 아래에 찍히므로 잘리지 않게 여백 확보
    layout: { padding: { top: 24, bottom: 24 } },
    plugins: {
      datalabels: {
        anchor: 'end',
        align:  'top',
        offset: 2,
        formatter: (v: number) => `${v}%`,
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        ticks: { callback: (v: string | number) => v + '%' },
      },
    },
  }), [showLabels, labelColor]);

  const progressOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    layout: { padding: { right: 52 } },
    plugins: {
      datalabels: {
        anchor: 'end',
        align:  'end',
        formatter: (v: number) => `${v}억`,
      },
    },
  }), [showLabels, labelColor]);

  const chartData = useMemo(() => {
    if (!summary || isLoading) return null;

    const monthly = summary.monthly;
    const parts   = sortParts(Object.keys(summary.by_part));
    const progressEntries = sortProgress(Object.keys(summary.by_progress ?? {}));

    // 원가 비율 카드용 — 메인 필터 무관, 항상 전체 데이터 기준(summaryAll이 아직 안 왔으면
    // 잠깐 메인 summary로 대체 — 로딩 중 빈 화면 대신 뭐라도 보여줌)
    const costSummary = summaryAll ?? summary;
    const costParts    = sortParts(Object.keys(costSummary.by_part));
    const costTotal    = costSummary.total;

    return {
      isEmpty: parts.length === 0 && monthly.length === 0,
      monthly: {
        labels:   monthly.map(m => m.month),
        revenues: monthly.map(m => toEokNum(m.revenue)),
        costs:    monthly.map(m => toEokNum(m.cost)),
        isFuture: monthly.map(m => isFutureMonth(m.month)),
      },
      planVsActual: {
        labels:        parts.map(stripPartPrefix),
        planInitial:   parts.map(p => toEokNum(summary.by_part[p].plan_initial)),
        junCheckTotal: parts.map(p => toEokNum(summary.by_part[p].jun_check_total)),
      },
      profitRate: {
        labels:   parts.map(stripPartPrefix),
        rates:    parts.map(p => summary.by_part[p].avg_profit_rate),
        profits:  parts.map(p => toEokNum(summary.by_part[p].operating_profit)),
        isProfit: parts.map(p => summary.by_part[p].operating_profit >= 0),
        // "파트별 추정 매출/원가" — 누계(jun_actual/jun_cost)가 아니라 연간 추정치 기준
        revenues: parts.map(p => toEokNum(summary.by_part[p].jun_check_total)),
        costs:    parts.map(p => toEokNum(summary.by_part[p].jun_cost_check)),
        planRevenue: parts.map(p => toEokNum(summary.by_part[p].plan_initial)),
        planCost:    parts.map(p => toEokNum(summary.by_part[p].plan_cost)),
      },
      // 전체 합계 구성비(금액 가중). 프로젝트별 비율의 단순평균이 아님 (직접원가 합계 67.5% vs 단순평균 56.7%).
      //    2026-09-10 경상손익(BF열) 조각 추가 — 매출행 기준. 이제 5조각 합 ≈ 매출(BH)이라
      //    "매출이 어디에 쓰였고 얼마 남았나" 구성이 됨(담당자 요청).
      costBreakdownTotal: {
        labels: ['직접원가', '인건비', '공통원가', '관리비', '경상손익'],
        values: [costTotal.cost_direct, costTotal.cost_labor, costTotal.cost_overhead, costTotal.cost_mgmt, costTotal.operating_profit].map(toEokNum),
      },
      costBreakdownByPart: Object.fromEntries(
        costParts.map(p => {
          const bp = costSummary.by_part[p];
          return [p, {
            labels: ['직접원가', '인건비', '공통원가', '관리비', '경상손익'],
            values: [bp.cost_direct ?? 0, bp.cost_labor ?? 0, bp.cost_overhead ?? 0, bp.cost_mgmt ?? 0, bp.operating_profit ?? 0].map(toEokNum),
          }];
        })
      ),
      // 팀 단위 구성비 — 소속 파트 전부 합산. "전체/팀/파트"를 대등한 개별 선택지로 두면서
      // 팀을 골라도 그 팀만의 원가 비율을 바로 보여주기 위함(파트를 거쳐야 하는 계단식이 아님)
      costBreakdownByTeam: Object.fromEntries(
        teams.map(team => {
          const allowed = new Set(teamParts[team] ?? []);
          const sums = [0, 0, 0, 0, 0];
          costParts.forEach(p => {
            if (!allowed.has(p)) return;
            const bp = costSummary.by_part[p];
            [bp.cost_direct ?? 0, bp.cost_labor ?? 0, bp.cost_overhead ?? 0, bp.cost_mgmt ?? 0, bp.operating_profit ?? 0]
              .forEach((v, i) => { sums[i] += v; });
          });
          return [team, { labels: ['직접원가', '인건비', '공통원가', '관리비', '경상손익'], values: sums.map(toEokNum) }];
        })
      ),
      partOptions: ['전체', ...costParts.map(stripPartPrefix)],
      partsRaw: costParts,
      teamParts,
      progress: {
        labels:       progressEntries,
        revenues:     progressEntries.map(p => toEokNum(summary.by_progress[p].revenue)),
        expenditures: progressEntries.map(p => toEokNum(summary.by_progress[p].cost)),
      },
    };
  }, [summary, summaryAll, isLoading, teams, teamParts]);

  // 원가 비율 카드에서 고른 파트(접두어 뗀 이름) → 원본 파트명. 드릴다운 모달이 메인 필터
  // 대신 이 카드의 선택 기준으로만 조회하도록 넘겨주기 위함(partOverride)
  const selectedCostPartRaw = useMemo(() => {
    if (!chartData || selectedCostPart === '전체') return undefined;
    return chartData.partsRaw.find(p => stripPartPrefix(p) === selectedCostPart);
  }, [chartData, selectedCostPart]);

  // 전체 > 팀 > 파트 배타적 선택 — 팀이 골라져 있으면 팀 구성비, 아니면 파트, 둘 다 없으면 전체
  const costBreakdown = useMemo(() => {
    if (!chartData) return { labels: [], values: [] };
    if (selectedCostTeam) return chartData.costBreakdownByTeam[selectedCostTeam] ?? chartData.costBreakdownTotal;
    if (selectedCostPart === '전체') return chartData.costBreakdownTotal;
    return selectedCostPartRaw ? chartData.costBreakdownByPart[selectedCostPartRaw] : chartData.costBreakdownTotal;
  }, [chartData, selectedCostTeam, selectedCostPart, selectedCostPartRaw]);

  if (!chartData || isLoading) {
    return {
      isLoading, isError, isEmpty: false, showLabels, labelColor,
      monthly:          { labels: [], revenues: [], costs: [], isFuture: [], options: monthlyOptions },
      planVsActual:     { labels: [], planInitial: [], junCheckTotal: [], options: planVsActualOptions },
      profitRate:       { labels: [], rates: [], profits: [], isProfit: [], revenues: [], costs: [], planRevenue: [], planCost: [], options: profitRateOptions },
      costBreakdown:    { labels: [], values: [] },
      progress:         { labels: [], revenues: [], expenditures: [], options: progressOptions },
      partOptions:      ['전체'],
      teams, selectedCostTeam, setSelectedCostTeam,
      selectedCostPart, setSelectedCostPart, selectedCostPartRaw,
      chartData: null,
    };
  }

  return {
    isLoading, isError, isEmpty: chartData.isEmpty, showLabels, labelColor,
    monthly:          { ...chartData.monthly,      options: monthlyOptions },
    planVsActual:     { ...chartData.planVsActual, options: planVsActualOptions },
    profitRate:       { ...chartData.profitRate,   options: profitRateOptions },
    costBreakdown,
    progress:         { ...chartData.progress,     options: progressOptions },
    partOptions:      chartData.partOptions,
    teams, selectedCostTeam, setSelectedCostTeam,
    selectedCostPart, setSelectedCostPart, selectedCostPartRaw,
    chartData,
  };
};
