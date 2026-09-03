import { useQuery } from '@tanstack/react-query';
import { getProjects } from '@/api/finance.api';
import { sortStages } from '@/utils/stageOrder';
import { extractRealCode } from '@/utils/projectCode';
import { STALE_5MIN, GC_10MIN } from '@/hooks/queryClient';
import type { Filters, Project } from '@/types/finance.types';

const EMPTY_FILTERS: Filters = { years: [], parts: [], stages: [] };

export interface FinanceCrossCheckViewModel {
  isLoading:    boolean;
  isAmbiguous:  boolean;
  fileCount:    number;
  sorted:       Project[];
}

// 재무이력 2뎁스 패널 — 프로젝트코드로 재무 PPT 이력 조회 + 보고단계 순으로 정렬
export const useFinanceCrossCheckViewModel = (projectCode: string): FinanceCrossCheckViewModel => {
  const realCode   = extractRealCode(projectCode);
  const searchTerm = realCode ?? projectCode;

  const { data, isLoading } = useQuery({
    queryKey: ['finance-by-code', searchTerm],
    queryFn:  () => getProjects(EMPTY_FILTERS, { page: 1, pageSize: 20, search: searchTerm, field: 'project_code' })
      .then(r => r.data),
    staleTime: STALE_5MIN,
    gcTime:    GC_10MIN,
  });

  const rows          = data ?? [];
  const distinctFiles = new Set(rows.map(r => r.filename));
  const isAmbiguous   = !realCode && distinctFiles.size > 1;
  const stageRank     = new Map(sortStages(rows.map(r => r.stage)).map((s, i) => [s, i]));
  const sorted        = [...rows].sort((a, b) => (stageRank.get(a.stage) ?? 99) - (stageRank.get(b.stage) ?? 99));

  return { isLoading, isAmbiguous, fileCount: distinctFiles.size, sorted };
};
