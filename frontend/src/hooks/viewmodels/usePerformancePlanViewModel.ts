import { useState, useMemo } from 'react';
import { usePerformancePlanSummary, usePerformancePlanData } from '@/hooks/usePerformancePlan';
import { usePerformanceOptions } from '@/hooks/usePerformanceData';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useServerSort } from '@/hooks/useServerSort';
import { useReactPagination } from '@/lib/pagination';
import { usePerfStore } from '@/store/perf.store';
import { toEokNum, stripPartPrefix } from '@/utils';
import { toEokNum2, roundHeadcount } from '@/utils/format';
import { sortParts, sortTeams } from '@/utils/partOrder';
import { perfExportHref } from '@/api/performance.api';
import type { PerfCompareCardData, PerfColorRole } from '@/hooks/viewmodels/usePerformanceViewModel';
import type { HeadcountChartData } from '@/hooks/viewmodels/usePerformanceChartViewModel';
import type { PerfProject, PerfPlanSummary } from '@/types/performance.types';
import type { ServerPagination, ServerSearch, ServerSorting, ServerColumnFilters } from '@/components/ui/DataTable';
import type { ColumnFilterValue } from '@/types/columnFilter.types';

/**
 * 2027 사업계획 보기(계획 모드, 2026-10-29) ViewModel — 27 사업계획 vs 26 연간 추정.
 * 기준월·누계·달성률이 없는 시트라 실적 보기(usePerformanceViewModel)와 필드·화면이 달라 따로 둠.
 * 계산(비율·합계)은 전부 백엔드(`/api/performance/summary?view=plan27`) — 여기선 단위(억) 변환·null 처리·표시용 글자만.
 */

type Accent = PerfCompareCardData['accent'];

/** 차트용(억 단위) — 파트는 화면 고정 순서, 원문자(①~) 뗀 이름 */
export interface PlanChartData {
  partLabels:  string[];
  rev26:       number[];
  rev27:       number[];
  /** 원가분석용 — 파트별 27 계획 직접원가(원가행 합, 억). 공통원가는 composition.overhead */
  cost27:      number[];
  /** 직접원가가 매출보다 큰(매출이익 마이너스) 파트 — 원가 막대를 손실색으로(실적 보기 원가분석과 같은 규칙) */
  costLoss:    boolean[];
  /** 27 계획 ÷ 26 추정 매출 % (백엔드 계산, 26이 0 이하면 null) — 막대 끝 수치 옆에 표시 */
  revRates:    (number | null)[];
  /** 27 계획 구성(매출 = 직접원가 + 인건비 + 공통원가 + 관리비 + 경상손익) — 파트별 누적 막대 */
  composition: { direct: number[]; labor: number[]; overhead: number[]; mgmt: number[]; profit: number[] };
  /** 구성 막대 칸마다 "27 계획 매출 대비 %"(백엔드 계산, 매출 0 이하면 null) — composition과 같은 순서 */
  compositionRates: { direct: (number | null)[]; labor: (number | null)[]; overhead: (number | null)[]; mgmt: (number | null)[]; profit: (number | null)[] };
  /** 파트별 원가율(%) = 원가(직접+공통) ÷ 매출 — 구성 막대 끝에 "(45.8%)" (백엔드 계산) */
  partCostRates: (number | null)[];
  /** 월별 차트 제목 옆 요약 — 27 계획 합계 매출·직접원가(억)와 원가율(%, 직접원가 ÷ 매출, 백엔드 계산) */
  monthTotals: { revenue: number; cost: number; costRate: number | null };
  /** 1~12월 계획 분배(실적 아님) */
  monthLabels:  string[];
  monthRevenue: number[];
  monthCost:    number[];
  /** 파트별 인당(억, 소수 둘째 자리 버림) — 27 계획 금액 ÷ 파트 인원. 실적 보기와 같은 규칙: 인원이 없거나(missingParts)
   *  팀 필터로 여러 팀에 걸친 파트(partialParts)는 막대에서 제외하고 이름만 알려 줌 */
  perCapita: {
    labels:       string[];
    revenue:      number[];
    mgmt:         number[];
    profit:       number[];
    missingParts: string[];
    partialParts: string[];
  };
  /** 파트별 인원 카드(2026 실적 보기와 같은 모양) — **2027 인원**(관리자 > 파트별 인원 > 2027년 인원). 입력된 파트만, 미입력 파트는 missingParts */
  headcount: HeadcountChartData;
  /** 구성(직접원가·인건비·공통원가·관리비·경상손익) 파이용 — 전체 / 팀별 / 파트별(키 = 원문자 뗀 파트명), 억 단위 */
  compositionPies: {
    total:  CompositionSlices;
    byTeam: Record<string, CompositionSlices>;
    byPart: Record<string, CompositionSlices>;
    teams:  string[];
  };
}

export interface CompositionSlices {
  labels: string[]; values: number[];
  /** 원가율(%) = 원가(직접+공통) ÷ 매출 — 이 범위(전체·팀·파트)의 값, 백엔드 계산 */
  costRate: number | null;
}

/** 파이·누적 막대가 같이 쓰는 조각 이름 — 순서 고정(실적 보기 원가 도넛과 같음) */
export const COMPOSITION_LABELS = ['직접원가', '인건비', '공통원가', '관리비', '경상손익'];

/**
 * 계획 요약 → 차트용 데이터(억 단위·화면 순서). 순수 함수라 훅 밖에서 테스트함.
 * 비율·인당 금액 계산은 백엔드가 끝낸 값을 단위(억)만 바꿔서 씀.
 */
export const buildPlanChartData = (summary: PerfPlanSummary | undefined): PlanChartData | null => {
  if (!summary || !summary.total?.y27) return null;
  const keys = sortParts(Object.keys(summary.by_part));
  const part = (k: string) => summary.by_part[k];
  const slices = (v: { cost_direct: number; cost_labor: number; cost_overhead: number; cost_mgmt: number; operating_profit: number; cost_rate?: number | null }): CompositionSlices => ({
    labels: COMPOSITION_LABELS,
    values: [v.cost_direct, v.cost_labor, v.cost_overhead, v.cost_mgmt, v.operating_profit].map(x => toEokNum(x ?? 0)),
    costRate: v.cost_rate ?? null,
  });
  const rates = (f: 'direct' | 'labor' | 'overhead' | 'mgmt' | 'profit') => keys.map(k => part(k).comp_rate?.[f] ?? null);
  const perHead = keys.filter(k => part(k).rev_per_head != null);
  return {
    partLabels: keys.map(stripPartPrefix),
    rev26:      keys.map(k => toEokNum(part(k).rev26)),
    rev27:      keys.map(k => toEokNum(part(k).rev27)),
    cost27:     keys.map(k => toEokNum(part(k).cost27)),
    costLoss:   keys.map(k => part(k).rev27 - part(k).cost27 < 0),
    revRates:   keys.map(k => part(k).rev_rate),
    composition: {
      direct:   keys.map(k => toEokNum(part(k).cost_direct)),
      labor:    keys.map(k => toEokNum(part(k).cost_labor)),
      overhead: keys.map(k => toEokNum(part(k).cost_overhead)),
      mgmt:     keys.map(k => toEokNum(part(k).cost_mgmt)),
      profit:   keys.map(k => toEokNum(part(k).operating_profit)),
    },
    compositionRates: { direct: rates('direct'), labor: rates('labor'), overhead: rates('overhead'), mgmt: rates('mgmt'), profit: rates('profit') },
    partCostRates: keys.map(k => part(k).cost_rate ?? null),
    monthTotals: {
      revenue:  toEokNum(summary.total.y27.revenue),
      cost:     toEokNum(summary.total.y27.cost),
      costRate: summary.total.direct_rate ?? null,
    },
    monthLabels:  summary.monthly.map(m => m.month),
    monthRevenue: summary.monthly.map(m => toEokNum(m.revenue)),
    monthCost:    summary.monthly.map(m => toEokNum(m.cost)),
    perCapita: {
      labels:  perHead.map(k => stripPartPrefix(k)),
      revenue: perHead.map(k => toEokNum2(part(k).rev_per_head)),
      mgmt:    perHead.map(k => toEokNum2(part(k).mgmt_per_head)),
      profit:  perHead.map(k => toEokNum2(part(k).profit_per_head)),
      missingParts: keys.filter(k => part(k).rev_per_head == null && !part(k).headcount_partial).map(stripPartPrefix),
      partialParts: keys.filter(k => part(k).headcount_partial).map(stripPartPrefix),
    },
    headcount: (() => {
      const rows = keys.map(k => ({ name: stripPartPrefix(k), cur: (part(k).headcount ?? 0) > 0 ? part(k).headcount! : null }));
      const ok = rows.filter(r => r.cur != null);
      return {
        labels:       ok.map(r => r.name),
        current:      ok.map(r => r.cur),
        totalCurrent: roundHeadcount(ok.reduce((t, r) => t + (r.cur ?? 0), 0)),   // 소수 첫째 자리 인원 — 부동소수 오차 정리
        missingParts: rows.filter(r => r.cur == null).map(r => r.name),
      };
    })(),
    compositionPies: {
      total: slices({
        cost_direct: summary.total.cost_direct ?? 0, cost_labor: summary.total.cost_labor ?? 0,
        cost_overhead: summary.total.cost_overhead ?? 0, cost_mgmt: summary.total.cost_mgmt ?? 0,
        operating_profit: summary.total.operating_profit ?? 0, cost_rate: summary.total.cost_rate ?? null,
      }),
      byTeam: Object.fromEntries(Object.entries(summary.by_team ?? {}).map(([t, v]) => [t, slices(v)])),
      byPart: Object.fromEntries(keys.map(k => [stripPartPrefix(k), slices(part(k))])),
      teams:  sortTeams(Object.keys(summary.by_team ?? {})),
    },
  };
};

export interface PerformancePlanViewModel {
  isLoading:         boolean;
  isFetching:        boolean;
  /** 요약을 다시 불러오는 중(첫 로딩 제외) — 섹션을 살짝 흐리게 */
  isSummaryFetching: boolean;
  isEmpty:           boolean;
  /** "2027년" — 시트 이름에서 온 연도, 없으면 빈 글자 */
  yearLabel:         string;
  kpiCards:          PerfCompareCardData[];
  chart:             PlanChartData | null;
  /** 구성 카드 상태 — mode: 파이(기본, 개별) / 막대(파트 비교). 파이 범위는 전체·팀·파트 중 하나 */
  compositionView: {
    mode:     'pie' | 'bar';
    setMode:  (m: 'pie' | 'bar') => void;
    team:     string;
    setTeam:  (v: string) => void;
    part:     string;
    setPart:  (v: string) => void;
    teams:    string[];
    /** 원문자 뗀 파트명('전체' 제외) */
    parts:    string[];
    pie:      CompositionSlices;
  };
  projects:          PerfProject[];
  serverPagination:  ServerPagination;
  serverSorting:     ServerSorting;
  serverSearch:      ServerSearch;
  progressOptions:   string[];
  selectedProgress:  string;
  setProgress:       (v: string) => void;
  exportHref:        string;
  serverColumnFilters: ServerColumnFilters;
  filterOptions:     Record<string, string[]>;
}

const SEARCH_FIELD_OPTIONS = [
  { value: '',             label: '전체' },
  { value: 'project_code', label: '프로젝트코드' },
  { value: 'project_name', label: '프로젝트명' },
  { value: 'manager',      label: '담당자' },
  { value: 'part',         label: '파트' },
  { value: 'team',         label: '팀' },
];

export const usePerformancePlanViewModel = (): PerformancePlanViewModel => {
  const pagination = useReactPagination(20);
  const sort = useServerSort(pagination.resetToFirstPage, 'performance-plan-project');
  const [searchField, setSearchField] = useState('');
  const [selectedProgress, setSelectedProgress] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFilterValue[]>([]);
  const search = useDebouncedSearch(350);

  const setProgress = (v: string) => {
    setSelectedProgress(v);
    pagination.resetToFirstPage();
  };

  const { data: summary, isLoading: sumLoading, isFetching: sumFetching } = usePerformancePlanSummary();
  const { data: paged, isLoading: projLoading, isFetching } = usePerformancePlanData({
    page: pagination.page, pageSize: pagination.pageSize, search: search.debouncedValue, field: searchField,
    sortBy: sort.sortBy ?? undefined, sortDir: sort.sortDir,
  }, selectedProgress, columnFilters);
  const { data: options } = usePerformanceOptions();

  const selectedParts = usePerfStore(s => s.selectedParts);
  const selectedTeam  = usePerfStore(s => s.selectedTeam);

  const filterOptions = useMemo<Record<string, string[]>>(() => ({
    progress: options?.progress ?? [],
    team:     sortTeams(options?.teams ?? []),
    part:     sortParts((options?.parts ?? []).map(stripPartPrefix)),
    manager:  options?.managers ?? [],
  }), [options]);

  const isLoading = sumLoading || projLoading;
  const total = summary?.total;

  const kpiCards = useMemo((): PerfCompareCardData[] => {
    const y26 = total?.y26;
    const y27 = total?.y27;
    if (!total || !y26 || !y27) return [];

    // 왼쪽 값(planStr) = 26 추정(비교 기준), 오른쪽 값(estStr) = 27 계획. 26 값이 없으면(팀·파트 필터 중 등) 왼쪽 '-'·차이 없음
    const mk = (
      id: string, label: string, accent: Accent, v26: number | null, v27: number, colorRole: PerfColorRole,
    ): PerfCompareCardData => {
      const rate = total.rate?.[id];
      const rateStr = rate == null ? undefined : `${rate.toFixed(1)}%`;
      const e = toEokNum(v27);
      const base = { kind: 'compare' as const, id, label, accent, colorRole, rateStr, rateLabel: '26 추정 대비' };
      if (v26 == null) {
        return { ...base, planStr: '-', estStr: `${e.toFixed(1)}억원`, planNum: 0, estNum: e, diffStr: '', diffUp: true };
      }
      const p = toEokNum(v26);
      const d = +(e - p).toFixed(1);
      return {
        ...base,
        planStr: `${p.toFixed(1)}억원`, estStr: `${e.toFixed(1)}억원`, planNum: p, estNum: e,
        diffStr: `${d >= 0 ? '+' : ''}${d.toFixed(1)}억원`, diffUp: d >= 0,
      };
    };

    const gross27 = y27.gross ?? 0;
    const profit27 = y27.profit ?? 0;
    return [
      mk('revenue', '27년 매출 (26 추정/27 계획)', 'brand', y26.revenue, y27.revenue, 'revenue'),
      mk('cost', '27년 직접 원가 (26 추정/27 계획)', 'purple', y26.cost, y27.cost, 'costDirect'),
      mk('overhead', '27년 공통원가 (26 추정/27 계획)', 'purple', y26.overhead, y27.overhead ?? 0, 'costOverhead'),
      {
        ...mk('grossProfit', '27년 매출이익 (26 추정/27 계획)', gross27 >= 0 ? 'profit' : 'loss', y26.gross, gross27,
          gross27 >= 0 ? 'profit' : 'loss'),
        sub: '매출 - (직접원가 + 공통원가)',
      },
      mk('labor', '27년 인건비 (26 추정/27 계획)', 'purple', y26.labor, y27.labor ?? 0, 'costLabor'),
      mk('mgmt', '27년 관리비 (26 추정/27 계획)', 'purple', y26.mgmt, y27.mgmt ?? 0, 'costMgmt'),
      {
        ...mk('profit', '27년 경상손익 (26 추정/27 계획)', profit27 >= 0 ? 'profit' : 'loss', y26.profit, profit27, 'costProfit'),
        sub: `손익률 ${(total.avg_profit_rate ?? 0).toFixed(1)}%`,
      },
    ];
  }, [total]);

  const chart = useMemo(() => buildPlanChartData(summary), [summary]);

  // 구성 카드 — 파이(개별로 보기, 기본) / 누적 막대(파트 전부 비교) 전환 + 파이의 범위(전체·팀·파트 중 하나, 서로 배타적).
  // 상단 팀·파트 필터와 따로 고름(실적 보기의 "전체 평균 원가 비율" 도넛과 같은 방식 — 비교 안 하고 하나씩 볼 때용)
  const [compMode, setCompMode] = useState<'pie' | 'bar'>('pie');
  const [compTeam, setCompTeamRaw] = useState('');           // '' = 팀 미선택
  const [compPart, setCompPartRaw] = useState('전체');       // '전체' = 파트 미선택
  const setCompTeam = (v: string) => { setCompTeamRaw(v); setCompPartRaw('전체'); };
  const setCompPart = (v: string) => { setCompPartRaw(v); setCompTeamRaw(''); };
  const pies = chart?.compositionPies;
  const pie = useMemo((): CompositionSlices => {
    if (!pies) return { labels: COMPOSITION_LABELS, values: COMPOSITION_LABELS.map(() => 0), costRate: null };
    if (compTeam) return pies.byTeam[compTeam] ?? pies.total;
    if (compPart !== '전체') return pies.byPart[compPart] ?? pies.total;
    return pies.total;
  }, [pies, compTeam, compPart]);

  return {
    isLoading,
    isFetching: isFetching ?? false,
    isSummaryFetching: !!sumFetching && !sumLoading,
    isEmpty: !isLoading && !total?.y27,
    yearLabel: summary?.year ? `${summary.year}년` : '',
    kpiCards,
    chart,
    compositionView: {
      mode: compMode, setMode: setCompMode,
      team: compTeam, setTeam: setCompTeam,
      part: compPart, setPart: setCompPart,
      teams: pies?.teams ?? [],
      parts: chart?.partLabels ?? [],
      pie,
    },
    projects: paged?.rows ?? [],

    serverSorting: sort,
    serverPagination: {
      total:            paged?.total ?? 0,
      page:             pagination.page,
      pageSize:         pagination.pageSize,
      onPageChange:     pagination.setPage,
      onPageSizeChange: pagination.setPageSize,
    },
    serverSearch: {
      value:    search.inputValue,
      onChange: (val) => {
        search.handleChange({ target: { value: val } } as React.ChangeEvent<HTMLInputElement>);
        pagination.resetToFirstPage();
      },
      field:         searchField,
      onFieldChange: (f) => { setSearchField(f); pagination.resetToFirstPage(); },
      fieldOptions:  SEARCH_FIELD_OPTIONS,
    },

    progressOptions: options?.progress ?? [],
    selectedProgress,
    setProgress,

    exportHref: perfExportHref(selectedParts, {
      page: 1, pageSize: 1, search: search.debouncedValue, field: searchField,
      sortBy: sort.sortBy ?? undefined, sortDir: sort.sortDir,
    }, selectedTeam, selectedProgress, columnFilters, 'plan27'),

    serverColumnFilters: {
      value: columnFilters,
      onChange: next => { setColumnFilters(next); pagination.resetToFirstPage(); },
    },
    filterOptions,
  };
};
