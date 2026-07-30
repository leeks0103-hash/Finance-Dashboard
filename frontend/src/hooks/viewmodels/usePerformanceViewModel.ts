import { useMemo } from 'react';
import { usePerformanceSummary } from '@/hooks/usePerformanceSummary';
import { usePerformanceData } from '@/hooks/usePerformanceData';
import { usePerformanceOptions } from '@/hooks/usePerformanceData';
import { useCountUp } from '@/hooks/useCountUp';
import { usePerfStore } from '@/store/perf.store';
import type { DataColumn } from '@/components/ui/DataTable';
import type { PerfProject } from '@/types/performance.types';

// 천원 → 억원
const toEok    = (v: number) => (v / 100_000).toFixed(1) + '억원';
const toEokNum = (v: number) => +(v / 100_000).toFixed(1);

export interface PerfKpiCard {
  label:   string;
  value:   string;
  sub:     string;
  accent:  'brand' | 'warn' | 'profit' | 'loss' | 'purple';
  trendUp: boolean;
}

export interface PerfPartRow {
  part:            string;
  planInitial:     string;
  junActual:       string;
  junCost:         string;
  junCheckTotal:   string;
  operatingProfit: string;
  profitRate:      string;
  count:           number;
  isLoss:          boolean;
  // 차트용 숫자
  planInitialNum:  number;
  junActualNum:    number;
  junCostNum:      number;
  profitRateNum:   number;
  costRateStr:     string;   // 원가율 (%)
}

// 천원 → 억원 (DataTable render용 공유 포맷터)
const toEokStr  = (v: unknown) => {
  const n = Number(v);
  return n ? (n / 100_000).toFixed(1) + '억' : '-';
};
const toPctStr  = (v: unknown) => {
  const n = Number(v);
  return n ? `${(n * 100).toFixed(1)}%` : '-';
};
const toNumStr  = (v: unknown) => {
  const n = Number(v);
  return n ? n.toLocaleString() : '-';
};

// 프로젝트 상세 DataTable 컬럼 정의 (ViewModel에서 관리 — pages/는 렌더링만)
export const PERF_PROJECT_COLUMNS: DataColumn<PerfProject>[] = [
  { header: '파트',            key: 'part',              align: 'left' },
  { header: '팀',              key: 'team',              align: 'left' },
  { header: '프로젝트코드',    key: 'project_code',      align: 'left', sortable: true },
  { header: '프로젝트명',      key: 'project_name',      align: 'left' },
  { header: '담당자',          key: 'manager',           align: 'left' },
  { header: '미래기술분류',    key: 'tech_category',     align: 'left' },
  { header: '사업구분',        key: 'biz_type',          align: 'left' },
  { header: '고객구분',        key: 'customer_type',     align: 'left' },
  { header: '사업계획',        key: 'biz_plan',          align: 'left' },
  { header: '진행',            key: 'progress',          align: 'left' },
  { header: '교육형태',        key: 'edu_type',          align: 'left' },
  { header: '사업유형',        key: 'biz_type2',         align: 'left' },
  { header: '예산코드',        key: 'budget_code',       align: 'left' },
  { header: '25년 실적',       key: 'actual_2025',       sortable: true, render: toEokStr },
  { header: '최초계획',        key: 'plan_initial',      sortable: true, render: toEokStr },
  { header: '계획원가율',      key: 'plan_cost_rate',    render: toPctStr },
  { header: '과정',            key: 'course_count',      render: toNumStr },
  { header: '차수',            key: 'session_count',     render: toNumStr },
  { header: '인원',            key: 'participant_count', render: toNumStr },
  { header: '6월 추정',        key: 'jun_est',           render: toEokStr },
  { header: '6월 추정율',      key: 'jun_est_rate',      render: toPctStr },
  { header: '6월 실적',        key: 'jun_actual',        sortable: true, render: toEokStr },
  { header: '6월 원가율',      key: 'jun_cost_rate',     render: toPctStr },
  { header: '원가율 차이',     key: 'cost_rate_diff',    render: (v) => v ? (Number(v)).toFixed(3) : '-' },
  { header: '추정 대비',       key: 'est_vs_actual',     render: toEokStr },
  { header: '원가율 사유',     key: 'cost_rate_reason',  align: 'left' },
  { header: '차이금액',        key: 'plan_diff_amount',  render: toEokStr },
  { header: '증감율',          key: 'plan_diff_rate',    render: toPctStr },
  { header: '사유',            key: 'plan_diff_reason',  align: 'left' },
  { header: '매출이익',        key: 'profit_gross',      render: toEokStr },
  { header: '직접원가',        key: 'cost_direct',       render: toEokStr },
  { header: '인건비',          key: 'cost_labor',        render: toEokStr },
  { header: '공통원가',        key: 'cost_overhead',     render: toEokStr },
  { header: '관리비',          key: 'cost_mgmt',         render: toEokStr },
  { header: '경상손익',        key: 'operating_profit',  sortable: true, render: toEokStr },
  { header: '손익률',          key: 'profit_rate',       sortable: true, render: (v) => v ? `${Number(v).toFixed(1)}%` : '-' },
  { header: '6월 점검 연간',   key: 'jun_check_total',   render: toEokStr },
  { header: '1월',  key: 'chk_m01', render: toEokStr },
  { header: '2월',  key: 'chk_m02', render: toEokStr },
  { header: '3월',  key: 'chk_m03', render: toEokStr },
  { header: '4월',  key: 'chk_m04', render: toEokStr },
  { header: '5월',  key: 'chk_m05', render: toEokStr },
  { header: '6월',  key: 'chk_m06', render: toEokStr },
  { header: '7월',  key: 'chk_m07', render: toEokStr },
  { header: '8월',  key: 'chk_m08', render: toEokStr },
  { header: '9월',  key: 'chk_m09', render: toEokStr },
  { header: '10월', key: 'chk_m10', render: toEokStr },
  { header: '11월', key: 'chk_m11', render: toEokStr },
  { header: '12월', key: 'chk_m12', render: toEokStr },
  { header: '점검원가율',      key: 'chk_cost_rate',     render: toPctStr },
  { header: '점검과정',        key: 'chk_course',        render: toNumStr },
  { header: '점검차수',        key: 'chk_session',       render: toNumStr },
  { header: '점검인원',        key: 'chk_participant',   render: toNumStr },
  { header: '대차금액',        key: 'balance_amount',    render: toEokStr },
  { header: '대차비율',        key: 'balance_rate',      render: (v) => v ? `${(Number(v)*100).toFixed(1)}%` : '-' },
  { header: '중복점검',        key: 'dup_check',         align: 'left' },
  { header: '참조코드',        key: 'ref_code',          align: 'left' },
  { header: '직접원가 소계',   key: 'sa_direct_total',   render: toNumStr },
  { header: '강사비',          key: 'sa_instructor',     render: toNumStr },
  { header: '보조강사비',      key: 'sa_sub_instructor', render: toNumStr },
  { header: '강의장',          key: 'sa_venue',          render: toNumStr },
  { header: '실습비',          key: 'sa_practice',       render: toNumStr },
  { header: '교재비',          key: 'sa_textbook',       render: toNumStr },
  { header: '기타직접',        key: 'sa_other_direct',   render: toNumStr },
  { header: '공통원가 소계',   key: 'sa_overhead_total', render: toNumStr },
  { header: '다과비',          key: 'sa_refreshment',    render: toNumStr },
  { header: '교육장',          key: 'sa_edu_venue',      render: toNumStr },
  { header: '주차비',          key: 'sa_parking',        render: toNumStr },
  { header: '실습비SW',        key: 'sa_sw_practice',    render: toNumStr },
  { header: '인턴인건비',      key: 'sa_intern',         render: toNumStr },
  { header: '인건비 소계',     key: 'sa_labor_total',    render: toNumStr },
  { header: '정규직',          key: 'sa_regular',        render: toNumStr },
  { header: '제경비',          key: 'sa_overhead_cost',  render: toNumStr },
  { header: '변동 검토의견',   key: 'change_note',       align: 'left' },
  { header: '비고',            key: 'note',              align: 'left' },
];

// 차트 데이터셋 — ViewModel에서 색상까지 포함해 반환 (pages/는 렌더링만)
export interface PerfChartDataset {
  label:           string;
  data:            number[];
  backgroundColor: string;
  borderRadius:    number;
}

export interface PerformanceViewModel {
  isLoading:    boolean;
  isFetching:   boolean;
  isEmpty:      boolean;
  kpiCards:     PerfKpiCard[];
  byPart:       PerfPartRow[];
  chartLabels:  string[];
  chartDatasets: PerfChartDataset[];
  projects:     PerfProject[];       // 직접 API 호출 제거 — ViewModel에서 제공
  parts:        string[];
  selectedParts: string[];
  togglePart:   (part: string) => void;
  resetFilters: () => void;
}

export const usePerformanceViewModel = (): PerformanceViewModel => {
  const { data: summary, isLoading: sumLoading } = usePerformanceSummary();
  const { data: rawProjects, isLoading: projLoading, isFetching } = usePerformanceData();
  const { data: options } = usePerformanceOptions();
  const selectedParts = usePerfStore(s => s.selectedParts);
  const togglePart    = usePerfStore(s => s.togglePart);
  const reset         = usePerfStore(s => s.reset);

  const isLoading = sumLoading || projLoading;
  const total     = summary?.total;

  const junActualRaw = total?.jun_actual        ?? 0;
  const profitRaw    = total?.operating_profit  ?? 0;
  const planRaw      = total?.plan_initial      ?? 0;
  const rateRaw      = total?.avg_profit_rate   ?? 0;
  const junCheckRaw  = total?.jun_check_total   ?? 0;

  const animJun      = useCountUp(toEokNum(junActualRaw));
  const animProfit   = useCountUp(toEokNum(profitRaw));
  const animPlan     = useCountUp(toEokNum(planRaw));
  const animRate     = useCountUp(rateRaw);
  const animCheck    = useCountUp(toEokNum(junCheckRaw));

  const kpiCards: PerfKpiCard[] = useMemo(() => {
    if (!total) return [];
    const achieveRate = planRaw > 0 ? ((junActualRaw / planRaw) * 100).toFixed(1) : '-';
    return [
      {
        label:   '매출 계획 (최초)',
        value:   `${animPlan.toFixed(1)}억원`,
        sub:     `${total.count}개 프로젝트`,
        accent:  'brand',
        trendUp: true,
      },
      {
        label:   '6월 실적 집계',
        value:   `${animJun.toFixed(1)}억원`,
        sub:     `달성률 ${achieveRate}%`,
        accent:  junActualRaw >= planRaw ? 'profit' : 'warn',
        trendUp: junActualRaw >= planRaw,
      },
      {
        label:   '6월 점검 연간합계',
        value:   `${animCheck.toFixed(1)}억원`,
        sub:     `원가 ${toEok(total.jun_cost)}`,
        accent:  'purple',
        trendUp: true,
      },
      {
        label:   '경상손익',
        value:   `${animProfit.toFixed(1)}억원`,
        sub:     `손익률 ${animRate.toFixed(1)}%`,
        accent:  profitRaw >= 0 ? 'profit' : 'loss',
        trendUp: profitRaw >= 0,
      },
    ];
  }, [total, animPlan, animJun, animCheck, animProfit, animRate,
      planRaw, junActualRaw, junCheckRaw, profitRaw, rateRaw]);

  const byPart = useMemo((): PerfPartRow[] => {
    if (!summary?.by_part) return [];
    return Object.entries(summary.by_part)
      .sort((a, b) => b[1].jun_actual - a[1].jun_actual)
      .map(([part, s]) => {
        const planInitialNum = toEokNum(s.plan_initial);
        const junActualNum   = toEokNum(s.jun_actual);
        const junCostNum     = toEokNum(s.jun_cost);
        const costRate     = junActualNum > 0
          ? `${((junCostNum / junActualNum) * 100).toFixed(1)}%`
          : '-';
        return {
          part,
          planInitial:     toEok(s.plan_initial),
          junActual:       toEok(s.jun_actual),
          junCost:         toEok(s.jun_cost),
          junCheckTotal:   toEok(s.jun_check_total),
          operatingProfit: toEok(s.operating_profit),
          profitRate:      `${s.avg_profit_rate.toFixed(1)}%`,
          count:           s.count,
          isLoss:          s.operating_profit < 0,
          planInitialNum,
          junActualNum,
          junCostNum,
          profitRateNum:   s.avg_profit_rate,
          costRateStr:     costRate,
        };
      });
  }, [summary?.by_part]);

  // 프로젝트 목록 — pages/에서 직접 훅 호출 금지, ViewModel에서 제공
  const projects = useMemo(
    () => Array.isArray(rawProjects) ? rawProjects : [],
    [rawProjects],
  );

  // 월별 차트 — 6월 점검 기준 월별 실적 합계
  const monthly = summary?.monthly ?? [];

  const chartLabels   = useMemo(
    () => monthly.map(m => m.month),
    [monthly],
  );
  const chartDatasets = useMemo((): PerfChartDataset[] => [
    {
      label:           '월별 실적',
      data:            monthly.map(m => +(m.revenue / 100_000).toFixed(1)),
      backgroundColor: 'rgba(59,130,246,0.65)',
      borderRadius:    4,
    },
  ], [monthly]);

  return {
    isLoading,
    isFetching:   isFetching ?? false,
    isEmpty:      !isLoading && !total,
    kpiCards,
    byPart,
    chartLabels,
    chartDatasets,
    projects,
    parts:        options?.parts ?? [],
    selectedParts,
    togglePart,
    resetFilters: reset,
  };
};
