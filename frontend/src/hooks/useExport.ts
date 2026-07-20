import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reloadData, getPdfUrl, getProjects } from '@/api';
import { useFilters } from './useFilters';

export const useExport = () => {
  const { filters } = useFilters();
  const qc = useQueryClient();

  const exportCsv = async () => {
    try {
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
    } catch (err) {
      console.error('[CSV Export]', err);
      alert('CSV 내보내기 중 오류가 발생했습니다.');
    }
  };

  const exportPdf = () => { window.location.href = getPdfUrl(filters); };

  const reloadMutation = useMutation({
    mutationFn: reloadData,
    onSuccess: () => {
      // 전체 캐시 무효화 — 새 데이터로 갱신
      qc.invalidateQueries();
    },
    onError: (err) => {
      console.error('[Reload]', err);
    },
  });

  return { exportCsv, exportPdf, reload: reloadMutation.mutate, isReloading: reloadMutation.isPending };
};
