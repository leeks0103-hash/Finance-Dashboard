import { useMutation } from '@tanstack/react-query';
import { reloadData, getPdfUrl, getProjects } from '@/api';
import { useFilters } from './useFilters';

export const useExport = () => {
  const { filters } = useFilters();

  const exportCsv = async () => {
    const rows = await getProjects(filters);
    const headers = ['프로젝트코드','연도','파트','단계','매출','지출','직접원가','인건비','공통원가','경상이익','이익율','비고'];
    const lines = [
      headers.join(','),
      ...rows.map(r =>
        [r.project_code, r.year, r.part, r.stage,
          r.revenue, r.expenditure, r.direct_cost, r.labor_cost,
          r.overhead, r.operating_profit, r.profit_rate, r.note].join(',')
      ),
    ];
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `재무현황_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => { window.location.href = getPdfUrl(filters); };

  const reloadMutation = useMutation({ mutationFn: reloadData });

  return { exportCsv, exportPdf, reload: reloadMutation.mutate, isReloading: reloadMutation.isPending };
};
