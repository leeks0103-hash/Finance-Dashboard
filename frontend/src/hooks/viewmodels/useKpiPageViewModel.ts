import { useState, useMemo } from 'react';
import { useKpiSummary, useKpiDataPaged } from '@/hooks/useKpiSummary';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useKpiFilterStore } from '@/store/kpiFilter.store';
import { useUiStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { makeBarOptions } from '@/utils/chartOptions';
import { getChartPalette } from '@/utils/chartColors';
import type { KpiRawRow } from '@/types/kpi.types';
import type { ServerPagination, ServerSearch } from '@/components/ui/DataTable';
import type { ChartOptions } from 'chart.js';

export interface KpiChartDataset {
  label:           string;
  data:            number[];
  backgroundColor: string;
  borderRadius:    number;
}

export interface KpiChartData {
  labels:   string[];
  targets:  number[];
  actuals:  number[];
  datasets: KpiChartDataset[];
  options:  ChartOptions<'bar'>;
}

export interface KpiSummaryRow {
  name:        string;
  agg:         string;
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

export const useKpiPageViewModel = (): KpiPageViewModel => {
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const search = useDebouncedSearch(350);
  const years  = useKpiFilterStore(s => s.years);
  const parts  = useKpiFilterStore(s => s.parts);
  const stages = useKpiFilterStore(s => s.stages);

  const { data: summary, isLoading: sumLoading } = useKpiSummary();
  const {
    data,
    isLoading: dataLoading,
    isFetching,
  } = useKpiDataPaged(
    { page, pageSize, search: search.debouncedValue },
    { years, parts, stages },
  );

  const isLoading = sumLoading || dataLoading;
  const items     = summary?.items ?? [];
  const rawRows: KpiRawRow[] = data?.rows ?? [];

  const { theme } = useTheme();
  const dark = theme === 'dark';
  const showLabels = useUiStore(s => s.showChartLabels);
  const labelColor = dark ? 'rgba(212,212,216,0.90)' : '#3F3F46';
  const palette = useMemo(() => getChartPalette(dark), [dark]);

  const chartOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    plugins: {
      datalabels: {
        anchor: 'end',
        align:  'end',
        formatter: (v: number) => v.toLocaleString(),
      },
    },
  }), [showLabels, labelColor]);

  const chart = useMemo((): KpiChartData => {
    // 괄호 안 세부 구분(과정 건수/구성 적절성 등)까지 유지 — 지우면 같은 항목명이 중복돼 헷갈림
    const labels  = items.map(it => it.name.trim());
    const targets = items.map(it => typeof it.target_2026 === 'number' ? it.target_2026 : 0);
    const actuals = items.map(it => typeof it.actual_2026 === 'number' ? it.actual_2026 : 0);
    return {
      labels, targets, actuals, options: chartOptions,
      datasets: [
        { label: '26년 목표', data: targets, backgroundColor: palette.target,  borderRadius: 4 },
        { label: '26년 실적', data: actuals, backgroundColor: palette.revenue, borderRadius: 4 },
      ],
    };
  }, [items, chartOptions, palette]);

  const summaryRows = useMemo((): KpiSummaryRow[] =>
    items.map(it => {
      // 신규/기존 건수 행 여부 — target이 문자열 "신규:N건/기존:N건" 형식이면 해당
      const isCountRow = typeof it.target_2026 === 'string' && /신규/.test(it.target_2026);
      return {
        name:       it.name,
        agg:        it.agg === 'sum' ? '합계' : '평균',
        targetStr:  typeof it.target_2026 === 'number' ? fmtNum(it.target_2026) : String(it.target_2026),
        targetNum:  typeof it.target_2026 === 'number' ? it.target_2026 : 0,
        // 신규/기존 타입: API가 이미 "신규:N건/기존:N건" 문자열 반환 → 그대로 사용
        actual:     isCountRow
          ? (it.actual_2026 != null && it.actual_2026 !== 0 ? String(it.actual_2026) : '신규:0건/기존:0건')
          : (it.actual_2026 ? fmtNum(it.actual_2026) : '-'),
        prevActual: isCountRow
          ? (it.prev_actual != null && it.prev_actual !== 0 ? String(it.prev_actual) : '신규:0건/기존:0건')
          : (it.prev_actual ? fmtNum(it.prev_actual) : '-'),
        achieveRate: it.achieve_rate !== null && it.achieve_rate !== undefined ? `${it.achieve_rate}%` : '-',
        isGood: (it.achieve_rate ?? 0) >= 100,
      };
    }),
  [items]);

  // flat 뷰 컬럼: 식별자 앞으로, 비고 계열만 제외, KPI 지표 순서로 정렬
  const rawCols = useMemo(() => {
    if (!rawRows.length) return [];
    const FRONT   = ['프로젝트코드', '수행연도', '파트명', '보고단계'];
    const TAIL    = ['파일명', '처리일시', '최종수정일시'];
    const METRICS = ['NPS', '전략기술과정_건수', '전략기술과정_적절성', '특화교육체계_건수',
                     'AI교육_고객사건수', 'AI교육_적절성', '신사업_매출억', '신사업_신규기존건수'];
    const all   = Object.keys(rawRows[0]).filter(c => !/비고/.test(c) && c !== '_row_num');
    const front = FRONT.filter(c => all.includes(c));
    const tail  = TAIL.filter(c => all.includes(c));
    const rest  = all.filter(c => !FRONT.includes(c) && !TAIL.includes(c));

    const metricIdx = (col: string) => {
      const i = METRICS.findIndex(m => col === m || col.startsWith(m + '_'));
      return i >= 0 ? i : METRICS.length;
    };
    rest.sort((a, b) => metricIdx(a) - metricIdx(b));

    return [...front, ...rest, ...tail];
  }, [rawRows]);

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
      page,
      pageSize,
      total:       data?.total ?? 0,
      onPageChange:     setPage,
      onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
    },

    serverSearch: {
      value:    search.inputValue,
      onChange: (val) => {
        search.handleChange({ target: { value: val } } as React.ChangeEvent<HTMLInputElement>);
        setPage(1);
      },
    },
  };
};
