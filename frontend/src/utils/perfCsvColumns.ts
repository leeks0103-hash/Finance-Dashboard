import type { PerfProject } from '@/types/performance.types';
import { PERF_MONTH } from './perfPeriod';

/**
 * 실적현황 CSV 내보내기용 핵심 컬럼 — 재무 탭 CSV와 동일하게 전체 80여개 필드 중
 * 식별·핵심 재무 지표만 선별(신사업 원가 세부 항목 등은 제외). PerformanceTable/columns.tsx의
 * 라벨과 동일하게 유지할 것.
 */
export const PERF_CSV_COLUMNS: { key: keyof PerfProject; label: string }[] = [
  { key: 'project_code',      label: '프로젝트코드' },
  { key: 'part',               label: '파트' },
  { key: 'team',                label: '팀' },
  { key: 'project_name',      label: '프로젝트명' },
  { key: 'manager',            label: '담당자' },
  { key: 'actual_2025',       label: '25년 실적' },
  { key: 'plan_initial',      label: '최초계획' },
  { key: 'jun_actual',        label: `${PERF_MONTH} 실적` },
  { key: 'jun_cost_rate',     label: `${PERF_MONTH} 원가율` },
  { key: 'operating_profit',  label: '경상손익' },
  { key: 'profit_rate',       label: '손익률' },
  { key: 'course_count',      label: '과정' },
  { key: 'session_count',     label: '차수' },
  { key: 'participant_count', label: '인원' },
  { key: 'note',               label: '비고' },
];
