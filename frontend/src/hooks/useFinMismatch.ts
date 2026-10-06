import { useQuery } from '@tanstack/react-query';
import { getPerfFinMismatch } from '@/api/performance.api';
import type { FinMismatchRow } from '@/types/performance.types';
import { downloadCsvFile } from './useExport';

const CSV_COLUMNS: { label: string; value: (r: FinMismatchRow) => unknown }[] = [
  { label: '프로젝트코드',          value: r => r.project_code },
  { label: '프로젝트명',            value: r => r.project_name },
  { label: '팀',                    value: r => r.team },
  { label: '파트',                  value: r => r.part },
  { label: '담당자',                value: r => r.manager },
  { label: '매출 불일치',           value: r => (r.revenue_mismatch ? 'O' : '') },
  { label: '당월 추정 매출(원)',    value: r => r.perf_revenue },
  { label: '재무 이력 매출(원)',    value: r => r.fin_revenue },
  { label: '매출 차이(원)',         value: r => r.revenue_diff },
  { label: '원가 불일치',           value: r => (r.cost_mismatch ? 'O' : '') },
  { label: '당월 추정 직접원가(원)', value: r => r.perf_cost },
  { label: '재무 이력 직접원가(원)', value: r => r.fin_cost },
  { label: '원가 차이(원)',         value: r => r.cost_diff },
  { label: '재무 보고서 파일명',    value: r => r.fin_filename },
];

/**
 * 관리자 기능 > 완료 프로젝트 재무 불일치 — 프로젝트 상세에서 빨간 칸으로 보이는 것(완료인데 실적현황 매출·직접원가가
 * 재무 이력 완료 보고와 1,000원 이상 다름)만 모은 목록 + CSV(2026-10-06). 로그인한 사람이 창을 연 동안만 조회
 */
export const useFinMismatch = (enabled: boolean) => {
  const query = useQuery({
    queryKey: ['perf-fin-mismatch'],
    queryFn:  getPerfFinMismatch,
    enabled,
    staleTime: 60_000,
  });
  const rows = query.data?.data ?? [];

  const exportCsv = () => downloadCsvFile(
    `완료프로젝트_재무불일치_${new Date().toISOString().slice(0, 10)}.csv`,
    CSV_COLUMNS.map(c => c.label),
    rows.map(r => CSV_COLUMNS.map(c => c.value(r))),
  );

  return { rows, total: query.data?.total ?? 0, isLoading: query.isLoading, isError: query.isError, exportCsv };
};
