import { useState, useMemo } from 'react';
import { useKpiSummary, useKpiDataPaged } from '@/hooks/useKpiSummary';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useReactPagination } from '@/lib/pagination';
import { useKpiFilterStore } from '@/store/kpiFilter.store';
import { useUiStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { makeBarOptions } from '@/utils/chartOptions';
import { getChartPalette, getChartTheme } from '@/utils/chartColors';
import { sortKpiRawCols } from '@/utils/kpiColumns';
import type { KpiRawRow } from '@/types/kpi.types';
import type { ServerPagination, ServerSearch } from '@/components/ui/DataTable';
import type { ChartOptions } from 'chart.js';

export interface KpiChartDataset {
  label:              string;
  data:               number[];
  backgroundColor:    string;
  borderRadius:       number;
  barPercentage:      number;
  categoryPercentage: number;
}

export interface KpiChartData {
  labels:      string[];
  planTargets: number[];
  targets:     number[];
  actuals:     number[];
  datasets:    KpiChartDataset[];
  options:     ChartOptions<'bar'>;
  tickColor:   string;
  /** 값 축 상한 — 최댓값보다 살짝 위, 5 단위로 올림 (막대·수치가 축 끝에 딱 붙지 않게) */
  xMax:        number | undefined;
}

// 최댓값 위로 약간 여유를 두고 5 단위로 올림. 값이 없거나 0이면 undefined(자동)
const niceAxisMax = (vals: number[]): number | undefined => {
  const m = Math.max(0, ...vals.filter(v => Number.isFinite(v)));
  if (m <= 0) return undefined;
  return Math.ceil((m * 1.05) / 5) * 5;
};

export interface KpiSummaryRow {
  name:        string;
  agg:         string;
  /** 26년 목표(사업계획) — 담당자 지정 고정값 (PLAN_TARGETS) */
  planTarget:  string;
  targetStr:   string;
  targetNum:   number;
  actual:      string;
  prevActual:  string;
  achieveRate: string;
  isGood:      boolean;
}

export interface KpiPageViewModel {
  isLoading:        boolean;
  isFetching:       boolean;
  available:        boolean;
  message?:         string;
  chart:            KpiChartData;
  summaryRows:      KpiSummaryRow[];
  rawRows:          KpiRawRow[];
  rawCols:          string[];
  serverPagination: ServerPagination;
  serverSearch:     ServerSearch;
}

const fmtNum = (v: number) => v !== 0 ? v.toLocaleString() : '0';

// "(교육 내용 구성 적절성)" 항목(전략기술과정_적절성 · AI교육_적절성)은 0~5 척도라
// 프로젝트 목표 평균이 4.3333… 식으로 길게 찍힘 — 소수점 한 자리로 고정 (담당자 지정)
const isScoreItem = (name: string) => name.includes('적절성');
const fmtScore    = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const SEARCH_FIELD_OPTIONS = [
  { value: '',        label: '전체' },
  { value: '프로젝트코드', label: '프로젝트코드' },
  { value: '파트명',      label: '파트명' },
  { value: '보고단계',    label: '보고단계' },
  { value: '파일명',      label: '파일명' },
];

/**
 * @param summaryPart  KPI 목표vs실적 차트 + KPI 집계 표에만 적용되는 파트 필터 ('' = 전체).
 *                     KPI 취합 표 필터(useKpiFilterStore)와는 완전히 별개.
 */
export const useKpiPageViewModel = (summaryPart = ''): KpiPageViewModel => {
  const pagination = useReactPagination(20);   // KPI 취합 — 30행은 너무 길어서 20행 기본
  const [searchField, setSearchField] = useState('');
  const search = useDebouncedSearch(350);
  const years  = useKpiFilterStore(s => s.years);
  const parts  = useKpiFilterStore(s => s.parts);
  const stages = useKpiFilterStore(s => s.stages);

  const { data: summary, isLoading: sumLoading } = useKpiSummary(summaryPart);
  const {
    data,
    isLoading: dataLoading,
    isFetching,
  } = useKpiDataPaged(
    { page: pagination.page, pageSize: pagination.pageSize, search: search.debouncedValue, field: searchField },
    { years, parts, stages },
  );

  const isLoading = sumLoading || dataLoading;
  const items     = summary?.items ?? [];
  const rawRows: KpiRawRow[] = data?.rows ?? [];

  const { theme } = useTheme();
  const dark = theme === 'dark';
  const showLabels = useUiStore(s => s.showChartLabels);
  const { labelColor } = getChartTheme(dark);
  const palette = useMemo(() => getChartPalette(dark), [dark]);

  const chartOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    plugins: {
      datalabels: {
        anchor: 'end',
        align:  'end',
        // "적절성"(0~5 척도) 막대는 값이 정수로 떨어져도 "4.0"처럼 소수점 첫째 자리까지 표시 —
        // 다른 항목 막대의 "4.33" 같은 표기와 자릿수를 맞춘다 (표 targetStr/actual과 동일 기준)
        formatter: (v: number, ctx) => {
          const label = String(ctx.chart.data.labels?.[ctx.dataIndex] ?? '');
          return isScoreItem(label) && Math.abs(v) < 10 ? fmtScore(v) : v.toLocaleString();
        },
      },
    },
  }), [showLabels, labelColor]);

  const chart = useMemo((): KpiChartData => {
    // 괄호 안 세부 구분(과정 건수/구성 적절성 등)까지 유지 — 지우면 같은 항목명이 중복돼 헷갈림
    const labels  = items.map(it => it.name.trim());
    // 사업계획 목표 — 백엔드 _PLAN_TARGETS 고정값(item.plan_target). 숫자 파싱만 여기서
    const planTargets = items.map(it => {
      const n = parseFloat(it.plan_target ?? '');
      return Number.isFinite(n) ? n : 0;
    });
    const targets = items.map(it => typeof it.target_2026 === 'number' ? it.target_2026 : 0);
    const actuals = items.map(it => typeof it.actual_2026 === 'number' ? it.actual_2026 : 0);
    return {
      labels, planTargets, targets, actuals, options: chartOptions, tickColor: labelColor,
      xMax: niceAxisMax([...planTargets, ...targets, ...actuals]),
      datasets: [
        // borderRadius 0 — 막대 끝을 각지게 (담당자 지정).
        // 3계열 한 세트 — categoryPercentage 0.66으로 세트 사이 간격 확보,
        // barPercentage 0.82로 세트 안 3개 막대에도 살짝 마진
        { label: '26년 목표 KPI',       data: planTargets, backgroundColor: palette.cost,    borderRadius: 0, barPercentage: 0.82, categoryPercentage: 0.66 },  // 원가 그래프색(Gold)
        { label: '26년 목표(프로젝트)', data: targets,     backgroundColor: palette.plan,    borderRadius: 0, barPercentage: 0.82, categoryPercentage: 0.66 },  // 중립 회색
        { label: '26년 실적',           data: actuals,     backgroundColor: palette.revenue, borderRadius: 0, barPercentage: 0.82, categoryPercentage: 0.66 },
      ],
    };
  }, [items, chartOptions, palette, labelColor]);

  const summaryRows = useMemo((): KpiSummaryRow[] =>
    items.map((it) => {
      // 신규/기존 건수 행 여부 — target이 문자열 "신규:N건/기존:N건" 형식이면 해당
      const isCountRow = typeof it.target_2026 === 'string' && /신규/.test(it.target_2026);
      return {
        name:       it.name,
        agg:        it.agg === 'sum' ? '합계' : '평균',
        planTarget: it.plan_target || '-',
        targetStr:  typeof it.target_2026 === 'number'
          ? (isScoreItem(it.name) ? fmtScore(it.target_2026) : fmtNum(it.target_2026))
          : String(it.target_2026),
        targetNum:  typeof it.target_2026 === 'number' ? it.target_2026 : 0,
        // 신규/기존 타입: API가 이미 "신규:N건/기존:N건" 문자열 반환 → 그대로 사용
        actual:     isCountRow
          ? (it.actual_2026 != null && it.actual_2026 !== 0 ? String(it.actual_2026) : '신규:0건/기존:0건')
          : (it.actual_2026 ? (isScoreItem(it.name) ? fmtScore(it.actual_2026) : fmtNum(it.actual_2026)) : '-'),
        prevActual: isCountRow
          ? (it.prev_actual != null && it.prev_actual !== 0 ? String(it.prev_actual) : '신규:0건/기존:0건')
          : (it.prev_actual ? (isScoreItem(it.name) ? fmtScore(it.prev_actual) : fmtNum(it.prev_actual)) : '-'),
        achieveRate: it.achieve_rate !== null && it.achieve_rate !== undefined ? `${it.achieve_rate}%` : '-',
        isGood: (it.achieve_rate ?? 0) >= 100,
      };
    }),
  [items]);

  // flat 뷰 컬럼: 식별자 앞으로, 비고 계열만 제외, KPI 지표 순서로 정렬
  const rawCols = useMemo(() => sortKpiRawCols(rawRows), [rawRows]);

  return {
    isLoading,
    isFetching,
    available: summary?.available ?? false,
    message:   summary?.message,
    chart,
    summaryRows,
    rawRows,
    rawCols,

    serverPagination: {
      page:             pagination.page,
      pageSize:         pagination.pageSize,
      total:            data?.total ?? 0,
      onPageChange:     pagination.setPage,
      onPageSizeChange: pagination.setPageSize,
    },

    serverSearch: {
      value:    search.inputValue,
      onChange: (val) => {
        search.handleChange({ target: { value: val } } as React.ChangeEvent<HTMLInputElement>);
        pagination.resetToFirstPage();
      },
      field:        searchField,
      onFieldChange: (f) => { setSearchField(f); pagination.resetToFirstPage(); },
      fieldOptions:  SEARCH_FIELD_OPTIONS,
    },
  };
};
