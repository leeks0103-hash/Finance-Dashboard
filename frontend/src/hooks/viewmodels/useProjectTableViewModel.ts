import { useCallback, useMemo } from 'react';
import { useProjects } from '@/hooks/useProjects';
import { formatBillion, formatRate } from '@/utils';
import type { Project } from '@/types';

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

// DataTable이 정렬·검색·페이지네이션을 내부에서 관리하므로
// ViewModel은 데이터·합계·행 변형 판단만 담당
export interface ProjectTableViewModel {
  data:          Project[];
  isLoading:     boolean;
  isFetching:    boolean;
  summary:       TableSummary;
  getRowVariant: (row: Project) => 'loss' | 'warn' | '';
}

export const useProjectTableViewModel = (): ProjectTableViewModel => {
  const { data = [], isLoading, isFetching } = useProjects();

  const summary = useMemo((): TableSummary => {
    if (!data.length) return {
      revenue: '-', expenditure: '-', directCost: '-',
      laborCost: '-', overhead: '-', operatingProfit: '-',
      avgProfitRate: '-', count: 0,
    };
    const sum = (key: keyof Project) =>
      data.reduce((a, r) => a + (Number(r[key]) || 0), 0);
    const rates = data.map(r => r.profit_rate).filter(v => isFinite(v));
    const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    return {
      revenue:         formatBillion(sum('revenue')),
      expenditure:     formatBillion(sum('expenditure')),
      directCost:      formatBillion(sum('direct_cost')),
      laborCost:       formatBillion(sum('labor_cost')),
      overhead:        formatBillion(sum('overhead')),
      operatingProfit: formatBillion(sum('operating_profit')),
      avgProfitRate:   formatRate(avgRate),
      count:           data.length,
    };
  }, [data]);

  return {
    data,
    isLoading,
    isFetching,
    summary,
    getRowVariant: useCallback((row: Project): 'loss' | 'warn' | '' => {
      if (row.operating_profit < 0) return 'loss';
      if (row.profit_rate >= 0 && row.profit_rate < 5) return 'warn';
      return '';
    }, []),
  };
};
