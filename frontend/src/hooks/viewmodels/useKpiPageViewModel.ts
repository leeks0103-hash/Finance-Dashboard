import { useMemo } from 'react';
import { useKpiSummary, useKpiData } from '@/hooks/useKpiSummary';
import type { KpiRawRow } from '@/types/kpi.types';

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
  datasets: KpiChartDataset[];  // 색상 포함 — pages/는 렌더링만
}

export interface KpiSummaryRow {
  name:        string;
  agg:         string;
  targetStr:   string;   // 표시용 (문자열 목표 그대로)
  targetNum:   number;   // 차트용 (숫자만, 문자열→0)
  actual:      string;
  achieveRate: string;
  isGood:      boolean;
}

export interface KpiPageViewModel {
  isLoading:  boolean;
  available:  boolean;
  message?:   string;
  chart:      KpiChartData;
  summaryRows: KpiSummaryRow[];
  rawRows:    KpiRawRow[];
  rawCols:    string[];   // useMemo로 메모이제이션 — 렌더마다 재계산 방지
}

const fmtNum = (v: number) => v !== 0 ? v.toLocaleString() : '0';

export const useKpiPageViewModel = (): KpiPageViewModel => {
  const { data: summary, isLoading: sumLoading } = useKpiSummary();
  const { data: rawData,  isLoading: dataLoading } = useKpiData();

  const isLoading = sumLoading || dataLoading;
  const items = summary?.items ?? [];
  const rawRows: KpiRawRow[] = Array.isArray(rawData) ? rawData : [];

  // 차트: 문자열 목표는 0으로 변환 → Chart.js에 숫자만 전달
  // 색상도 ViewModel에서 반환 — pages/는 렌더링만
  const chart = useMemo((): KpiChartData => {
    const labels  = items.map(it => it.name.replace(/\s*\([^)]+\)\s*/g, ' ').trim());
    const targets = items.map(it => typeof it.target_2026 === 'number' ? it.target_2026 : 0);
    const actuals = items.map(it => it.actual_2026);
    return {
      labels, targets, actuals,
      datasets: [
        { label: '26년 목표', data: targets, backgroundColor: 'rgba(59,130,246,0.65)', borderRadius: 4 },
        { label: '26년 실적', data: actuals, backgroundColor: 'rgba(16,185,129,0.7)',  borderRadius: 4 },
      ],
    };
  }, [items]);

  const summaryRows = useMemo((): KpiSummaryRow[] =>
    items.map(it => ({
      name:       it.name,
      agg:        it.agg === 'sum' ? '합계' : '평균',
      targetStr:  typeof it.target_2026 === 'number'
        ? fmtNum(it.target_2026)
        : String(it.target_2026),
      targetNum:  typeof it.target_2026 === 'number' ? it.target_2026 : 0,
      actual:     fmtNum(it.actual_2026),
      achieveRate: it.achieve_rate !== null && it.achieve_rate !== undefined
        ? `${it.achieve_rate}%`
        : '-',
      isGood: (it.achieve_rate ?? 0) >= 100,
    })),
  [items]);

  // rawCols 메모이제이션: Object.keys는 렌더마다 재계산되므로 useMemo 사용 (Fix 효율)
  const rawCols = useMemo(
    () => rawRows.length > 0 ? Object.keys(rawRows[0]) : [],
    [rawRows],
  );

  return {
    isLoading,
    available:   summary?.available ?? false,
    message:     summary?.message,
    chart,
    summaryRows,
    rawRows,
    rawCols,
  };
};
