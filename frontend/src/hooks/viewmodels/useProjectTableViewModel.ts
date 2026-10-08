import { useState, useCallback, useEffect, useMemo } from 'react';
import { useProjects } from '@/hooks/useProjects';
import { useSummary } from '@/hooks/useSummary';
import { useFilterOptions } from '@/hooks/useFilterOptions';
import { usePerformanceOptions } from '@/hooks/usePerformanceData';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { useQuickSearchStore } from '@/store/quickSearch.store';
import { useReactPagination } from '@/lib/pagination';
import { formatBillion, formatRate } from '@/utils';
import { sortStages } from '@/utils/stageOrder';
import { sortParts, sortTeams, partRank, PART_ORDER } from '@/utils/partOrder';
import type { Project } from '@/types';
import type { ServerPagination, ServerSearch, ServerSorting } from '@/components/ui/DataTable';
import { useServerSort } from '@/hooks/useServerSort';

export interface TableSummary {
  revenue:         string;
  expenditure:     string;
  directCost:      string;
  laborCost:       string;
  overhead:        string;
  operatingProfit: string;
  avgProfitRate:   string;
  count:           number;
}

export interface ProjectTableViewModel {
  rows:             Project[];
  total:            number;
  isLoading:        boolean;
  isFetching:       boolean;
  summary:          TableSummary;
  getRowVariant:    (row: Project) => 'loss' | 'warn' | '';
  serverPagination: ServerPagination;
  /** 전체 기준 정렬(서버) */
  serverSorting:    ServerSorting;
  serverSearch:     ServerSearch;
  /** 표 자체의 셀렉트 필터 — ''면 전체(전역 필터 그대로). 파트 옵션은 팀을 고르면 그 팀 소속으로 좁혀짐 */
  teamFilter:       SelectFilter;
  partFilter:       SelectFilter;
  stageFilter:      SelectFilter;
}

interface SelectFilter {
  value:    string;
  onChange: (value: string) => void;
  options:  string[];
}

/** 아무 행도 안 걸리게 하는 값 — 빈 배열은 백엔드에서 "필터 없음(전체)"으로 읽히므로 */
const NO_MATCH = ['__none__'];

const EMPTY_SUMMARY: TableSummary = {
  revenue: '-', expenditure: '-', directCost: '-',
  laborCost: '-', overhead: '-', operatingProfit: '-',
  avgProfitRate: '-', count: 0,
};

const SEARCH_FIELD_OPTIONS = [
  { value: '',            label: '전체' },
  { value: 'project_code', label: '프로젝트코드' },
  { value: 'part',         label: '파트' },
  { value: 'stage',        label: '보고단계' },
  { value: 'note',         label: '비고' },
  { value: 'filename',     label: '파일명' },
];

export const useProjectTableViewModel = (): ProjectTableViewModel => {
  const pagination = useReactPagination(30);
  const sort = useServerSort(pagination.resetToFirstPage, 'finance-project');
  const [searchField, setSearchField] = useState('');
  const search = useDebouncedSearch(350);
  const [stage, setStage] = useState('');
  const [team, setTeam]   = useState('');
  const [part, setPart]   = useState('');
  const { rawStages, parts: allParts } = useFilterOptions();
  const stageOptions = useMemo(() => sortStages(rawStages), [rawStages]);

  // 팀은 실적현황(사업계획 엑셀)에만 있는 정보 — 팀 → 소속 파트 매핑을 거기서 가져와 재무 파트명에 맞춤.
  // 두 데이터의 파트 표기가 달라("③ 전동화ㆍ차량개발" ↔ "전차") partRank(키워드 매칭)로 같은 파트인지 판정
  const { data: perfOptions } = usePerformanceOptions();
  const teamOptions = useMemo(() => sortTeams(perfOptions?.teams ?? []), [perfOptions?.teams]);
  const teamParts = useMemo(() => {
    if (!team) return null;
    const ranks = new Set((perfOptions?.team_parts?.[team] ?? []).map(partRank));
    return allParts.filter(p => partRank(p) < PART_ORDER.length && ranks.has(partRank(p)));
  }, [team, perfOptions?.team_parts, allParts]);
  const partOptions = useMemo(() => sortParts(teamParts ?? allParts), [teamParts, allParts]);
  // 조회에 넘길 파트 — 파트를 골랐으면 그것만, 팀만 골랐으면 그 팀 소속 파트 전부
  const queryParts = useMemo(
    () => (part ? [part] : teamParts ? (teamParts.length ? teamParts : NO_MATCH) : undefined),
    [part, teamParts],
  );

  // 인사이트 섹션 코드 클릭 → 검색창 자동 채우기
  const financeQuick    = useQuickSearchStore(s => s.finance);
  const clearFinanceQ   = useQuickSearchStore(s => s.setFinance);
  useEffect(() => {
    if (!financeQuick) return;
    search.setFilter(financeQuick);
    pagination.resetToFirstPage();
    clearFinanceQ('');
  }, [financeQuick]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: paged, isLoading, isFetching } = useProjects({
    page:     pagination.page,
    pageSize: pagination.pageSize,
    search:   search.debouncedValue,
    field:    searchField,
    stage,
    parts:    queryParts,
    sortBy:   sort.sortBy ?? undefined,
    sortDir:  sort.sortDir,
  });

  // 합계는 /api/summary (전체 필터 기준) — 페이지네이션 여부와 무관한 전체 집계값
  const { data: sumData } = useSummary();

  const summary: TableSummary = sumData ? {
    revenue:         formatBillion(sumData.total_revenue),
    expenditure:     formatBillion(sumData.total_expenditure),
    directCost:      formatBillion(sumData.cost_breakdown.direct_cost),
    laborCost:       formatBillion(sumData.cost_breakdown.labor_cost),
    overhead:        formatBillion(sumData.cost_breakdown.overhead),
    operatingProfit: formatBillion(sumData.total_profit),
    avgProfitRate:   formatRate(sumData.avg_profit_rate),
    count:           sumData.count,
  } : EMPTY_SUMMARY;

  return {
    rows:      paged?.rows  ?? [],
    total:     paged?.total ?? 0,
    isLoading,
    isFetching,
    summary,

    getRowVariant: useCallback((row: Project): 'loss' | 'warn' | '' => {
      if (row.operating_profit < 0) return 'loss';
      if (row.profit_rate >= 0 && row.profit_rate < 5) return 'warn';
      return '';
    }, []),

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
      field:        searchField,
      onFieldChange: (f) => { setSearchField(f); pagination.resetToFirstPage(); },
      fieldOptions:  SEARCH_FIELD_OPTIONS,
    },

    teamFilter: {
      value:    team,
      // 팀을 바꾸면 파트 선택은 풂 — 다른 팀 파트가 남아 0건이 되는 것 방지
      onChange: (t) => { setTeam(t); setPart(''); pagination.resetToFirstPage(); },
      options:  teamOptions,
    },

    partFilter: {
      value:    part,
      onChange: (p) => { setPart(p); pagination.resetToFirstPage(); },
      options:  partOptions,
    },

    stageFilter: {
      value:    stage,
      onChange: (s) => { setStage(s); pagination.resetToFirstPage(); },
      options:  stageOptions,
    },
  };
};
