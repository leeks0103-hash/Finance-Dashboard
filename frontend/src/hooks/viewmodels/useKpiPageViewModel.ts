import { useState, useMemo } from 'react';
import { useKpiSummary, useKpiDataPaged, useKpiAnomalyException } from '@/hooks/useKpiSummary';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useVisible, useVisibilitySettings } from '@/hooks/useVisibility';
import { alertDialog, confirmDialog } from '@/utils/dialog';
import { buildServerPagination, buildServerSearch } from './serverTableProps';
import { useReactPagination } from '@/lib/pagination';
import { useKpiFilterStore } from '@/store/kpiFilter.store';
import { useUiStore } from '@/store';
import { useTheme } from '@/hooks/useTheme';
import { makeBarOptions } from '@/utils/chartOptions';
import { getChartTheme } from '@/utils/chartColors';
import { useChartPalette } from '@/hooks/useChartPalette';
import { sortKpiRawCols } from '@/utils/kpiColumns';
import type { KpiRawRow, KpiAnomaly, KpiAnomalyExcepted } from '@/types/kpi.types';
import type { ServerPagination, ServerSearch, ServerSorting } from '@/components/ui/DataTable';
import { useServerSort } from '@/hooks/useServerSort';
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
  /** 요약 조회 실패 — 데이터 없음(available=false)과 구분(2026-11-04, QA UI M6) */
  isError:          boolean;
  /** 요약 다시 불러오기 */
  refetch:          () => void;
  available:        boolean;
  message?:         string;
  chart:            KpiChartData;
  summaryRows:      KpiSummaryRow[];
  rawRows:          KpiRawRow[];
  rawCols:          string[];
  serverPagination: ServerPagination;
  /** 전체 기준 정렬(서버) */
  serverSorting:    ServerSorting;
  serverSearch:     ServerSearch;
  /** 보고단계 완료 전인데 실적 조기입력된 프로젝트 수(한 프로젝트는 지표가 여럿이어도 1건) — 0이면 배너 미노출 */
  anomalyCount:     number;
  anomalies:        KpiAnomaly[];
  /** 관리자가 예외 처리한 건(관리자에게만) — 안내·빨간 행에서는 빠져 있고 여기서만 해제 */
  exceptedAnomalies: KpiAnomalyExcepted[];
  /** 예외 처리/해제 버튼을 보여줄지 — 모든 사람 화면에 영향을 주므로 관리자만 */
  canExceptAnomaly:  boolean;
  exceptPending:     boolean;
  /** 확인창 뒤 예외 처리(done=true)/해제(false) — 서버가 현재 값을 기억해 PPT 값이 바뀌면 저절로 풀림 */
  exceptAnomaly:     (item: KpiAnomaly, done: boolean) => Promise<void>;
  /** 조기입력 의심 배너를 보여줄지 — 공개 범위(kpiAnomaly)가 이 사람에게 열려 있고 의심 행이 1건 이상일 때 */
  showAnomalyNotice:     boolean;
  /** 배너 ×(닫기)를 보여줄지 — 모든 사람 화면에 영향을 주므로 관리자만 */
  canCloseAnomalyNotice: boolean;
  /** 배너 닫기 — 확인창 뒤 공개 범위를 '숨김'으로(모두에게 안 보임). 다시 켜는 건 관리자 기능 > 화면·접근 */
  closeAnomalyNotice:    () => Promise<void>;
}

// KPI 탭 숫자 — 자릿수 맞춤 없이 값 그대로, 소수점은 둘째 자리까지 (2026-10-01 담당자 지정.
// 예전 "적절성은 소수점 한 자리 고정(4.0)"은 폐기 — 0.18 같은 값이 0.2로 보였음)
const fmtNum = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });

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
 * @param anomalyOnly  true면 KPI 취합 표를 조기입력 의심 행만으로 서버측 필터링 (배너 "한눈에 보기").
 */
export const useKpiPageViewModel = (summaryPart = '', anomalyOnly = false): KpiPageViewModel => {
  const pagination = useReactPagination(20);   // KPI 취합 — 30행은 너무 길어서 20행 기본
  const sort = useServerSort(pagination.resetToFirstPage, 'kpi-raw');
  const [searchField, setSearchField] = useState('');
  const search = useDebouncedSearch(350);
  const years  = useKpiFilterStore(s => s.years);
  const parts  = useKpiFilterStore(s => s.parts);
  const stages = useKpiFilterStore(s => s.stages);

  // 조기입력 의심 안내 배너 — 공개 범위(kpiAnomaly)를 따름. 관리자가 × 로 닫으면 '숨김'이 돼 모든 사람에게 안 보이고(2026-11-09),
  // 관리자 기능 > 화면·접근 > 공개 범위에서 다시 켬. 닫는 건 모두에게 영향이라 관리자만 ×가 보임
  const noticeAllowed = useVisible('kpiAnomaly');
  const isAdmin = useUiStore(s => s.adminAuthed);
  const { update: updateVisibility } = useVisibilitySettings();
  // 배너가 숨겨지면 "한눈에 보기" 필터도 풀림 — 안 풀리면 [전체 보기] 버튼이 없는데 표가 계속 의심 행만 보여 줌
  const anomalyFilter = anomalyOnly && noticeAllowed;

  const { data: summary, isLoading: sumLoading, isError: sumError, refetch: refetchSummary } = useKpiSummary(summaryPart);
  const {
    data,
    isLoading: dataLoading,
    isFetching,
  } = useKpiDataPaged(
    { page: pagination.page, pageSize: pagination.pageSize, search: search.debouncedValue, field: searchField,
      sortBy: sort.sortBy ?? undefined, sortDir: sort.sortDir },
    { years, parts, stages },
    anomalyFilter,
  );

  const closeAnomalyNotice = async () => {
    const ok = await confirmDialog(
      '이 안내를 닫으면 모든 사람에게 보이지 않습니다.\n다시 보이게 하려면 관리자 기능 > 화면·접근 > 공개 범위에서 "KPI 조기입력 의심 안내"를 전체로 바꾸세요.',
      { title: '조기입력 안내 닫기', confirmText: '닫기', cancelText: '취소' },
    );
    if (ok) updateVisibility({ kpiAnomaly: 'none' });
  };

  const exception = useKpiAnomalyException();
  const exceptAnomaly = async (item: KpiAnomaly, done: boolean) => {
    const ok = await confirmDialog(
      done
        ? `이 프로젝트의 조기입력 의심을 예외 처리하면 모든 사람에게 안내·빨간 행으로 표시되지 않습니다.\n의도한 입력일 때만 하세요. PPT 값이 바뀌면 자동으로 다시 표시됩니다.\n\n${item.project_code || '(코드 없음)'} · ${item.stage}`
        : '해제하면 이 프로젝트가 다시 모든 사람에게 조기입력 의심으로 표시됩니다.',
      { title: done ? '예외 처리할까요?' : '예외 처리를 해제할까요?', confirmText: done ? '예외 처리' : '해제', cancelText: '취소' },
    );
    if (!ok) return;
    try {
      const r = await exception.set([item.id], done);
      if (!r.ok) await alertDialog(r.error ?? '처리하지 못했습니다', { error: true });
    } catch {
      await alertDialog('처리하지 못했습니다 — 잠시 뒤 다시 시도하세요', { error: true });
    }
  };

  const isLoading = sumLoading || dataLoading;
  const items     = summary?.items ?? [];
  const rawRows: KpiRawRow[] = data?.rows ?? [];

  const { theme } = useTheme();
  const dark = theme === 'dark';
  const showLabels = useUiStore(s => s.showChartLabels);
  const { labelColor } = getChartTheme(dark);
  const palette = useChartPalette();

  const chartOptions = useMemo(() => makeBarOptions(showLabels, labelColor, {
    plugins: {
      datalabels: {
        anchor: 'end',
        align:  'end',
        formatter: (v: number) => fmtNum(v),
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
        { label: '26년 계획', data: targets,     backgroundColor: palette.plan,    borderRadius: 0, barPercentage: 0.82, categoryPercentage: 0.66 },  // 중립 회색
        { label: '26년 실적(완료 프로젝트)', data: actuals,     backgroundColor: palette.revenue, borderRadius: 0, barPercentage: 0.82, categoryPercentage: 0.66 },
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
          ? fmtNum(it.target_2026)
          : String(it.target_2026),
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
  const rawCols = useMemo(() => sortKpiRawCols(rawRows), [rawRows]);

  return {
    isLoading,
    isFetching,
    isError: sumError,
    refetch: () => { void refetchSummary(); },
    available: summary?.available ?? false,
    message:   summary?.message,
    chart,
    summaryRows,
    rawRows,
    rawCols,
    anomalyCount: summary?.anomaly_count ?? 0,
    anomalies:    summary?.anomalies ?? [],
    exceptedAnomalies: isAdmin ? (summary?.excepted ?? []) : [],
    canExceptAnomaly:  isAdmin,
    exceptPending:     exception.pending,
    exceptAnomaly,
    showAnomalyNotice: noticeAllowed && (summary?.anomaly_count ?? 0) > 0,
    canCloseAnomalyNotice: isAdmin,
    closeAnomalyNotice,

    serverSorting: sort,

    serverPagination: buildServerPagination(pagination, data?.total ?? 0),

    serverSearch: buildServerSearch(search, pagination, searchField, setSearchField, SEARCH_FIELD_OPTIONS),
  };
};
